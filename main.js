const { app, BrowserWindow, Tray, nativeImage, ipcMain } = require('electron');
const { Octokit } = require("@octokit/core");
const path = require('path');
const fs = require('fs');
var AutoLaunch = require('auto-launch');

const userDataPath = path.join(app.getPath('userData'), 'user-config.json');
let trayPulls = null;
let trayIssues = null;
let windowPulls = null;
let windowIssues = null;
let userConfig = null;

let octokit;

function loadUserData() {
    if (fs.existsSync(userDataPath)) {
        userConfig = JSON.parse(fs.readFileSync(userDataPath));
        octokit = new Octokit({});
    } else {
        userConfig = null;
    }
}

function saveUserData(data) {
    fs.writeFileSync(userDataPath, JSON.stringify(data, null, 2));
    userConfig = data;
    octokit = new Octokit({});
}

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

function createTrayIcons() {
    const pullsIconPath = path.join(__dirname, 'pulls.png');
    const pullsTrayIcon = nativeImage.createFromPath(pullsIconPath).resize({ width: 20, height: 20 });

    trayPulls = new Tray(pullsTrayIcon);
    trayPulls.setToolTip('Pull Requests');
    trayPulls.on('click', async () => {
        if (!windowPulls) createPullsWindow();

        try {
            const pullRequests = await fetchUserPullRequests();
            windowPulls.webContents.send('pull-requests', pullRequests);
            windowPulls.show();
        } catch (error) {
            console.error(error.message);
        }
    });

    const issuesIconPath = path.join(__dirname, 'issues.png');
    const issuesTrayIcon = nativeImage.createFromPath(issuesIconPath).resize({ width: 20, height: 20 });

    trayIssues = new Tray(issuesTrayIcon);
    trayIssues.setToolTip('Issues');
    trayIssues.on('click', async () => {
        if (!windowIssues) createIssuesWindow();

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
        var sysTrayToolsAutoLaunch = new AutoLaunch({
            name: 'Github SysTray Tools',
        });
        
        sysTrayToolsAutoLaunch.enable();
        sysTrayToolsAutoLaunch.isEnabled()
        .then(function(isEnabled){
            if(isEnabled){
                return;
            }
            sysTrayToolsAutoLaunch.enable();
        })
        .catch(function(err){
            {}
        });
        function restartApp() {
            app.relaunch();
            app.exit(); // or app.quit()
        }
        restartApp()
    });

    setupWindow.on('closed', () => {
        setupWindow = null;
    });
}

// Copyright 2025 Rihaan Meher

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.