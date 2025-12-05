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

    // Clear cache/state on load
    fileInput.value = '';
    startTimecodeInput.value = '01:00:00;00';
    const uploadedFileSection = document.getElementById('file-uploaded-section');
    const uploadedFilename = document.getElementById('uploaded-filename');
    const clearBtn = document.getElementById('clear-btn');
    const updateBtn = document.getElementById('update-btn');

    // Clear cache/state on load
    fileInput.value = '';
    startTimecodeInput.value = '01:00:00;00';
    edlPreview.textContent = '';
    previewSection.classList.add('hidden');
    uploadedFileSection.classList.add('hidden');
    dropZone.classList.remove('hidden');

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

    // Explicit update button
    if (updateBtn) {
        updateBtn.addEventListener('click', () => {
            console.log('Manual update requested');
            updatePreview();
        });
    }

    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Clear requested');
            currentFile = null;
            currentSRTContent = '';
            fileInput.value = '';
            edlPreview.textContent = '';

            previewSection.classList.add('hidden');
            uploadedFileSection.classList.add('hidden');
            dropZone.classList.remove('hidden');
        });
    }

    startTimecodeInput.addEventListener('blur', () => {
        const val = startTimecodeInput.value;
        if (!val) return;

        const fps = parseFloat(fpsSelect.value);
        const frames = parseTimecode(val, fps);
        startTimecodeInput.value = framesToTimecode(frames, fps);
        updatePreview(); // Ensure preview is updated with formatted value
    });

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

            // UI Updates
            dropZone.classList.add('hidden');
            uploadedFileSection.classList.remove('hidden');
            uploadedFilename.textContent = file.name;

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
                        text: text.trim().replace(/<[^>]*>/g, '')
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

    function parseTimecode(timecode, fps) {
        console.log(`Parsing timecode: "${timecode}" (Type: ${typeof timecode}) at ${fps} FPS`);

        // Handle simple integer input as hours (e.g. "1" -> 01:00:00:00)
        if (/^\d+$/.test(timecode.trim())) {
            const h = parseInt(timecode.trim(), 10);
            return Math.round(h * 3600 * fps);
        }

        const parts = timecode.split(/[:;]/).map(Number);

        if (parts.length === 3) {
            // HH:MM:SS -> assume frames 0
            const [h, m, s] = parts;
            const totalSeconds = h * 3600 + m * 60 + s;
            return Math.round(totalSeconds * fps);
        }

        if (parts.length === 4) {
            // HH:MM:SS:FF
            const [h, m, s, f] = parts;
            const totalSeconds = h * 3600 + m * 60 + s;
            return Math.round(totalSeconds * fps) + f;
        }

        console.warn('Invalid timecode format, returning 0');
        return 0;
    }

    function generateEDL(subtitles, options) {
        console.log('Generating EDL with options:', options);
        const { fps, markerColor, startTimecode } = options;
        const title = currentFile ? currentFile.name.replace(/\.srt$/i, '') : 'Untitled';

        // Ensure startTimecode is a string
        const safeStartTimecode = String(startTimecode || '01:00:00;00');
        const startOffsetFrames = parseTimecode(safeStartTimecode, fps);
        console.log(`Start Offset Frames: ${startOffsetFrames} (${framesToTimecode(startOffsetFrames, fps)})`);

        let edl = `TITLE: ${title}\nFCM: NON-DROP FRAME\n\n`;

        subtitles.forEach((sub, index) => {
            const eventNum = (index + 1).toString().padStart(3, '0');

            // Convert SRT times to frames and add offset
            const subStartFrames = timeToFrames(sub.start, fps);
            const subEndFrames = timeToFrames(sub.end, fps);

            const finalStartFrames = Math.round(startOffsetFrames + subStartFrames);
            const finalEndFrames = Math.round(startOffsetFrames + subEndFrames);

            const startTime = framesToTimecode(finalStartFrames, fps);
            const endTime = framesToTimecode(finalEndFrames, fps);

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
