function init() {
    console.log('SRT to EDL Converter: Initializing...');

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const previewSection = document.getElementById('preview-section');
    const edlPreview = document.getElementById('edl-preview');
    const downloadBtn = document.getElementById('download-btn');
    const fpsSelect = document.getElementById('fps-select');
    const markerColorSelect = document.getElementById('marker-color');
    const startTimecodeInput = document.getElementById('start-timecode');

    let currentFile = null;
    let currentSRTContent = '';

    // Global drag and drop prevention to stop browser from opening files
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    }, false);

    window.addEventListener('drop', (e) => {
        e.preventDefault();
    }, false);

    // Drag and drop handlers
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        console.log('Drop event detected');
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        if (e.dataTransfer.files.length) {
            console.log('File dropped:', e.dataTransfer.files[0].name);
            handleFile(e.dataTransfer.files[0]);
        } else {
            console.warn('Drop event fired but no files found');
        }
    });

    // Click handler for the drop zone to trigger file input
    dropZone.addEventListener('click', (e) => {
        // Don't trigger if clicking the button directly (to avoid double trigger)
        if (e.target !== uploadBtn && e.target !== fileInput) {
            console.log('Drop zone clicked, triggering file input');
            fileInput.click();
        }
    });

    // Explicit button handler
    if (uploadBtn) {
        uploadBtn.addEventListener('click', (e) => {
            console.log('Upload button clicked');
            // Label triggers input automatically
        });
    }

    fileInput.addEventListener('change', (e) => {
        console.log('File input changed');
        if (e.target.files.length) {
            console.log('File selected:', e.target.files[0].name);
            handleFile(e.target.files[0]);
        }
    });

    // Option change handlers
    fpsSelect.addEventListener('change', updatePreview);
    markerColorSelect.addEventListener('change', updatePreview);
    startTimecodeInput.addEventListener('change', updatePreview);

    downloadBtn.addEventListener('click', downloadEDL);

    function handleFile(file) {
        try {
            console.log('Processing file:', file.name);
            if (!file.name.toLowerCase().endsWith('.srt')) {
                alert('Please upload a valid .srt file');
                console.warn('Invalid file type');
                return;
            }

            currentFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                console.log('File read successfully');
                currentSRTContent = e.target.result;
                updatePreview();
                previewSection.classList.remove('hidden');
            };
            reader.onerror = (e) => {
                console.error('Error reading file:', e);
                alert('Error reading file');
            };
            reader.readAsText(file);
        } catch (error) {
            console.error('Error in handleFile:', error);
            alert('An error occurred while processing the file.');
        }
    }

    function parseSRT(srt) {
        const subtitles = [];
        const blocks = srt.trim().replace(/\r\n/g, '\n').split('\n\n');

        blocks.forEach(block => {
            const lines = block.split('\n');
            if (lines.length >= 3) {
                const id = lines[0];
                const timecodeLine = lines[1];
                const text = lines.slice(2).join(' ');

                const [start, end] = timecodeLine.split(' --> ');

                if (start && end) {
                    subtitles.push({
                        id,
                        start: start.trim(),
                        end: end.trim(),
                        text: text.trim()
                    });
                }
            }
        });

        return subtitles;
    }

    function timeToFrames(timeStr, fps) {
        // SRT format: HH:MM:SS,mmm
        const [time, ms] = timeStr.split(',');
        const [hours, minutes, seconds] = time.split(':').map(Number);

        const totalSeconds = hours * 3600 + minutes * 60 + seconds + (parseInt(ms) / 1000);
        return Math.round(totalSeconds * fps);
    }

    function framesToTimecode(frames, fps) {
        const h = Math.floor(frames / (3600 * fps));
        const m = Math.floor((frames % (3600 * fps)) / (60 * fps));
        const s = Math.floor(((frames % (3600 * fps)) % (60 * fps)) / fps);
        const f = Math.floor(((frames % (3600 * fps)) % (60 * fps)) % fps);

        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
    }

    // Helper to convert SRT time (HH:MM:SS,mmm) to EDL timecode (HH:MM:SS:FF)
    function srtTimeToEdlTime(srtTime, fps) {
        const [timePart, msPart] = srtTime.split(',');
        const [h, m, s] = timePart.split(':').map(Number);
        const ms = parseInt(msPart, 10);

        // Calculate frames from milliseconds
        // Frame duration in ms = 1000 / fps
        const frameDuration = 1000 / fps;
        const frames = Math.floor(ms / frameDuration);

        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`;
    }

    function generateEDL(subtitles, options) {
        const { fps, markerColor, startTimecode } = options;
        const title = currentFile ? currentFile.name.replace(/\.srt$/i, '') : 'Untitled';

        let edl = `TITLE: ${title}\nFCM: NON-DROP FRAME\n\n`;

        subtitles.forEach((sub, index) => {
            const eventNum = (index + 1).toString().padStart(3, '0');
            const startTime = srtTimeToEdlTime(sub.start, fps);
            const endTime = srtTimeToEdlTime(sub.end, fps);

            // Clean up text (remove newlines for the marker name)
            const cleanText = sub.text.replace(/\n/g, ' ');

            edl += `${eventNum}  AX       V     C        ${startTime} ${endTime} ${startTime} ${endTime}\n`;
            // Using Resolve specific format
            edl += ` |C:${markerColor} |M:${cleanText} |D:1\n\n`;
        });

        return edl;
    }

    function updatePreview() {
        if (!currentSRTContent) return;

        const fps = parseFloat(fpsSelect.value);
        const markerColor = markerColorSelect.value;
        const startTimecode = startTimecodeInput.value;

        const subtitles = parseSRT(currentSRTContent);
        const edl = generateEDL(subtitles, { fps, markerColor, startTimecode });

        edlPreview.textContent = edl;
    }

    function downloadEDL() {
        if (!currentSRTContent) return;

        const edlContent = edlPreview.textContent;
        const blob = new Blob([edlContent], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        // Ensure correct extension with case-insensitive replace
        const fileName = currentFile ? currentFile.name.replace(/\.srt$/i, '.edl') : 'subtitles.edl';

        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
