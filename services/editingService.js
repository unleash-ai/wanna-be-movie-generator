const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

class EditingService {
  /**
   * Assemble final movie to ~30s by concatenating scene videos and mixing background music.
   * @param {Array} videoResults - Array of { video: { videoFile: { filePath } }, sceneIndex }
   * @param {Object} musicResult - music generation result with musicFile.filePath
   * @param {number} targetSeconds - target total duration, default 30
   * @returns {Promise<{filePath: string, filename: string}>}
   */
  async assembleMovie(videoResults, musicResult, targetSeconds = 30, dialogueResults = [], perSceneSeconds = 8) {
    const uploadsDir = path.join(__dirname, '../uploads/videos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ordered = [...videoResults]
      .filter((r) => r && r.video && r.video.videoFile && r.video.videoFile.filePath)
      .sort((a, b) => a.sceneIndex - b.sceneIndex);

    if (ordered.length === 0) {
      throw new Error('No scene videos provided for assembly');
    }

    const inputs = ordered.map((r) => r.video.videoFile.filePath);
    let musicPath = musicResult && musicResult.musicFile && musicResult.musicFile.filePath
      ? musicResult.musicFile.filePath
      : null;
    // Fallback: allow a local placeholder track via env
    if (!musicPath && process.env.MUSIC_PLACEHOLDER_PATH) {
      try {
        const candidate = path.isAbsolute(process.env.MUSIC_PLACEHOLDER_PATH)
          ? process.env.MUSIC_PLACEHOLDER_PATH
          : path.join(process.cwd(), process.env.MUSIC_PLACEHOLDER_PATH);
        if (fs.existsSync(candidate)) {
          musicPath = candidate;
          console.log(`🎵 Using placeholder music from ${musicPath}`);
        }
      } catch (_) {
        // ignore
      }
    }
    const dialogues = Array.isArray(dialogueResults) ? dialogueResults.filter(d => d && d.audio && d.audio.filePath) : [];

    const outputFile = `final_movie_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.mp4`;
    const outputPath = path.join(uploadsDir, outputFile);

    // Build ffmpeg filter graph to concat videos and mix music; cut to target duration
    // Using concat filter to ensure consistent A/V streams, then amix with music
    return new Promise((resolve, reject) => {
      try {
        const cmd = ffmpeg();

        inputs.forEach((inp) => cmd.input(inp));
        if (musicPath) {
          cmd.input(musicPath);
        }
        dialogues.forEach((d) => cmd.input(d.audio.filePath));

        const numVideoInputs = inputs.length;
        // Create concat filter descriptors
        const vLabels = Array.from({ length: numVideoInputs }, (_, i) => `[${i}:v:0]`);
        // Build video filter: concat only when multiple inputs
        let filters = [];
        if (numVideoInputs === 1) {
          filters.push(`[0:v:0]trim=0:${targetSeconds},setpts=N/FRAME_RATE/TB[vtrim]`);
        } else {
          const concatFilter = `${vLabels.join('')}concat=n=${numVideoInputs}:v=1:a=0[v]`;
          filters.push(concatFilter);
        }

        // Dialogue offsets
        const musicInputIndex = musicPath ? numVideoInputs : null;
        const dialogueStartIndex = numVideoInputs + (musicPath ? 1 : 0);

        // Prepare dialogue delay filters
        const dialogueOutLabels = [];
        if (dialogues.length > 0) {
          const dialoguesByScene = new Map();
          dialogues.forEach((d) => {
            const idx = typeof d.sceneIndex === 'number' ? d.sceneIndex : 0;
            if (!dialoguesByScene.has(idx)) dialoguesByScene.set(idx, []);
            dialoguesByScene.get(idx).push(d);
          });

          dialogues.forEach((d, k) => {
            const inputIdx = dialogueStartIndex + k;
            const sceneIdx = typeof d.sceneIndex === 'number' ? d.sceneIndex : 0;
            const perSceneList = dialoguesByScene.get(sceneIdx) || [d];
            const localIndex = perSceneList.indexOf(d);
            const stride = perSceneSeconds / (perSceneList.length + 1);
            const startSec = sceneIdx * perSceneSeconds + (localIndex + 1) * stride;
            const startMs = Math.max(0, Math.floor(startSec * 1000));
            const outLabel = `d${k}`;
            filters.push(`[${inputIdx}:a:0]adelay=${startMs}|${startMs},volume=1.0[${outLabel}]`);
            dialogueOutLabels.push(`[${outLabel}]`);
          });
        }

        const mixInputs = [];
        if (musicPath) {
          // Ensure music is present and long enough; pad to targetSeconds
          filters.push(`[${musicInputIndex}:a:0]volume=0.25,apad=pad_dur=${targetSeconds}[music]`);
          mixInputs.push('[music]');
        }
        mixInputs.push(...dialogueOutLabels);
        const haveAudio = mixInputs.length > 0;
        if (haveAudio) {
          const amixCount = mixInputs.length;
          filters.push(`${mixInputs.join('')}amix=inputs=${amixCount}:duration=longest,atrim=0:${targetSeconds},asetpts=N/SR/TB[amixed]`);
        }

        // Small trim on video when concat used
        if (numVideoInputs > 1) {
          filters.push(`[v]trim=0:${targetSeconds},setpts=N/FRAME_RATE/TB[vtrim]`);
        }

        const outLabels = haveAudio ? (numVideoInputs > 1 ? ['vtrim', 'amixed'] : ['vtrim', 'amixed']) : (numVideoInputs > 1 ? ['vtrim'] : ['vtrim']);
        cmd.complexFilter(filters, outLabels);
        const outOpts = [
          numVideoInputs > 1 ? '-map [vtrim]' : '-map [vtrim]',
          '-c:v libx264',
          '-preset veryfast',
          '-crf 23',
          `-t ${targetSeconds}`,
          '-movflags +faststart'
        ];
        if (haveAudio) {
          outOpts.splice(1, 0, '-map [amixed]');
          outOpts.splice(5, 0, '-c:a aac', '-b:a 192k');
        } else {
          outOpts.push('-an');
        }
        cmd.outputOptions(outOpts);

        cmd.on('error', async (err) => {
          console.warn('⚠️ ffmpeg complex assembly failed, falling back to simple concat:', err?.message || err);
          try {
            const fallback = await this.simpleConcat(inputs, targetSeconds);
            resolve(fallback);
          } catch (e2) {
            reject(e2);
          }
        });
        cmd.on('end', () => resolve({ filePath: outputPath, filename: outputFile }));
        cmd.save(outputPath);
      } catch (e) {
        reject(e);
      }
    });
  }

  async simpleConcat(inputs, targetSeconds = 30) {
    const path = require('path');
    const fs = require('fs');
    const uploadsDir = path.join(__dirname, '../uploads/videos');
    const listPath = path.join(uploadsDir, `concat_${Date.now()}.txt`);
    const outputFile = `final_movie_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.mp4`;
    const outputPath = path.join(uploadsDir, outputFile);

    // Write concat list file
    fs.writeFileSync(listPath, inputs.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));

    return new Promise((resolve, reject) => {
      const cmd = ffmpeg()
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy', `-t ${targetSeconds}`, '-movflags +faststart'])
        .on('error', (err) => reject(err))
        .on('end', () => resolve({ filePath: outputPath, filename: outputFile }))
        .save(outputPath);
    });
  }
}

module.exports = new EditingService();


