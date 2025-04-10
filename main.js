const { app, BrowserWindow, Tray, nativeImage, ipcMain } = require('electron');
const { Octokit } = require("@octokit/core");
const path = require('path');
const fs = require('fs');
console.log(app.getPath('userData'));

const userDataPath = path.join(app.getPath('userData'), 'user-config.json');
let trayPulls = null;
let trayIssues = null;
let windowPulls = null;
let windowIssues = null;
let userConfig = null;

// Initialize Octokit
let octokit;

// Fetch or initialize user data
function loadUserData() {
    if (fs.existsSync(userDataPath)) {
        userConfig = JSON.parse(fs.readFileSync(userDataPath));
        octokit = new Octokit({});
    } else {
        userConfig = null; // First-time setup needed
    }
}

// Save user data
function saveUserData(data) {
    fs.writeFileSync(userDataPath, JSON.stringify(data, null, 2));
    userConfig = data;
    octokit = new Octokit({});
}

// Fetch all open pull requests for the user
async function fetchUserPullRequests() {
    try {
        const response = await octokit.request('GET /search/issues', {
            q: `type:pr is:open author:${userConfig.githubUsername}`,
            per_page: 100,
        });
        return response.data.items;
    } catch (error) {
        console.error('Error fetching pull requests:', error.message);
        throw error;
    }
}

// Fetch all open issues assigned to or created by the user
async function fetchUserIssues() {
    try {
        const response = await octokit.request('GET /search/issues', {
            q: `type:issue is:open author:${userConfig.githubUsername}`,
            per_page: 100,
        });
        return response.data.items;
    } catch (error) {
        console.error('Error fetching issues:', error.message);
        throw error;
    }
}

// Create the pull requests window
function createPullsWindow() {
    if (windowPulls && !windowPulls.isDestroyed()) return;

    windowPulls = new BrowserWindow({
        width: 400,
        height: 450,
        frame: false,
        resizable: false,
        show: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    windowPulls.loadFile('pulls.html');

    windowPulls.on('blur', () => {
        windowPulls.hide();
    });

    windowPulls.on('closed', () => {
        windowPulls = null;
    });
}

// Create the issues window
function createIssuesWindow() {
    if (windowIssues && !windowIssues.isDestroyed()) return;

    windowIssues = new BrowserWindow({
        width: 400,
        height: 450,
        frame: false,
        resizable: false,
        show: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    windowIssues.loadFile('issues.html');

    windowIssues.on('blur', () => {
        windowIssues.hide();
    });

    windowIssues.on('closed', () => {
        windowIssues = null;
    });
}

// Create the tray icons
function createTrayIcons() {
    // Pull Requests Tray Icon
    const pullsIconPath = path.join(__dirname, 'pulls.png');
    const pullsTrayIcon = nativeImage.createFromPath(pullsIconPath).resize({ width: 20, height: 20 });

    trayPulls = new Tray(pullsTrayIcon);
    trayPulls.setToolTip('Pull Requests');
    trayPulls.on('click', async () => {
        if (!windowPulls) createPullsWindow();

        // Refetch pull requests before showing the window
        try {
            const pullRequests = await fetchUserPullRequests();
            windowPulls.webContents.send('pull-requests', pullRequests);
            windowPulls.show();
        } catch (error) {
            console.error(error.message);
        }
    });

    // Issues Tray Icon
    const issuesIconPath = path.join(__dirname, 'issues.png');
    const issuesTrayIcon = nativeImage.createFromPath(issuesIconPath).resize({ width: 20, height: 20 });

    trayIssues = new Tray(issuesTrayIcon);
    trayIssues.setToolTip('Issues');
    trayIssues.on('click', async () => {
        if (!windowIssues) createIssuesWindow();

        // Refetch issues before showing the window
        try {
            const issues = await fetchUserIssues();
            windowIssues.webContents.send('user-issues', issues);
            windowIssues.show();
        } catch (error) {
            console.error(error.message);
        }
    });
}

app.on('ready', () => {
    loadUserData();

    if (userConfig) {
        createTrayIcons();
    } else {
        showSetupWindow();
    }
});

// Show setup window for first-time users
function showSetupWindow() {
    setupWindow = new BrowserWindow({
        width: 400,
        height: 300,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    setupWindow.loadFile('setup.html');

    ipcMain.once('setup-complete', (event, data) => {
        saveUserData(data);
        createTrayIcons();
        function restartApp() {
            app.relaunch();
            app.quit(); // or app.exit()
        }
        restartApp()
    });

    setupWindow.on('closed', () => {
        setupWindow = null;
    });
}
