/**
 * Puppeteer script for recording landing page demo video
 * Usage: node record-video.js [url]
 *
 * Requirements:
 *   npm install puppeteer puppeteer-screen-recorder
 *
 * Output: landing-demo.mp4
 * Optional: Convert to GIF with ffmpeg:
 *   ffmpeg -i landing-demo.mp4 -vf "fps=15,scale=1280:-1:flags=lanczos" -c:v gif landing-demo.gif
 */

const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

const DEFAULT_URL = 'http://localhost:3000';
const OUTPUT_FILE = 'landing-demo.mp4';

// Recording configuration
const recorderConfig = {
    followNewTab: false,
    fps: 30,
    videoFrame: {
        width: 1280,
        height: 720
    },
    videoCrf: 18,
    videoCodec: 'libx264',
    videoPreset: 'ultrafast',
    videoBitrate: 3000,
    aspectRatio: '16:9'
};

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function smoothScroll(page, targetY, duration = 1000) {
    const steps = 60;
    const stepDuration = duration / steps;

    const startY = await page.evaluate(() => window.scrollY);
    const distance = targetY - startY;

    for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        // Ease-in-out cubic
        const eased = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentY = startY + distance * eased;
        await page.evaluate((y) => window.scrollTo(0, y), currentY);
        await delay(stepDuration);
    }
}

async function scrollToSection(page, selector) {
    const element = await page.$(selector);
    if (!element) {
        console.warn(`[Record] Section not found: ${selector}`);
        return;
    }

    const box = await element.boundingBox();
    if (!box) {
        console.warn(`[Record] Could not get bounding box for: ${selector}`);
        return;
    }

    // Get current scroll position
    const scrollY = await page.evaluate(() => window.scrollY);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    // Calculate target position (center the section in viewport)
    const targetY = scrollY + box.y - viewportHeight / 4;

    console.log(`[Record] Scrolling to ${selector}`);
    await smoothScroll(page, Math.max(0, targetY), 1500);
}

async function recordLanding(url) {
    console.log('[Record] Starting browser...');

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,720'
        ],
        defaultViewport: {
            width: 1280,
            height: 720
        }
    });

    const page = await browser.newPage();

    // Initialize recorder
    const recorder = new PuppeteerScreenRecorder(page, recorderConfig);

    try {
        console.log(`[Record] Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'networkidle0' });

        // Start recording
        console.log(`[Record] Starting recording to ${OUTPUT_FILE}`);
        await recorder.start(OUTPUT_FILE);

        // Wait for initial hero animations
        console.log('[Record] Waiting for hero animations...');
        await delay(4000);

        // Scroll through sections with pauses
        const sections = [
            { selector: '#about', name: 'About', pauseMs: 3000 },
            { selector: '#skills', name: 'Skills', pauseMs: 3500 },
            { selector: '#projects', name: 'Projects', pauseMs: 3500 },
            { selector: '#contact', name: 'Contact', pauseMs: 2500 }
        ];

        for (const section of sections) {
            await scrollToSection(page, section.selector);
            console.log(`[Record] Viewing ${section.name} section...`);
            await delay(section.pauseMs);
        }

        // Scroll back to top
        console.log('[Record] Scrolling back to top...');
        await smoothScroll(page, 0, 2000);
        await delay(2000);

        // Stop recording
        console.log('[Record] Stopping recording...');
        await recorder.stop();

        console.log(`[Record] Video saved to ${OUTPUT_FILE}`);
        console.log('[Record] To convert to GIF, run:');
        console.log(`  ffmpeg -i ${OUTPUT_FILE} -vf "fps=15,scale=1280:-1:flags=lanczos" -c:v gif landing-demo.gif`);

    } catch (error) {
        console.error('[Record] Error:', error);
        await recorder.stop();
    } finally {
        await browser.close();
        console.log('[Record] Done!');
    }
}

// Get URL from command line or use default
const url = process.argv[2] || DEFAULT_URL;

console.log('[Record] Landing Page Video Recorder');
console.log(`[Record] Target URL: ${url}`);
console.log(`[Record] Output: ${OUTPUT_FILE}`);
console.log('');

recordLanding(url);
