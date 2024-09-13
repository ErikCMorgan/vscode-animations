const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const appRoot = vscode.env.appRoot;
const productFile = path.join(appRoot, "product.json");
const origFile = `${productFile}.orig.${vscode.version}`;

const workbenchCssPath = path.join(
    appRoot,
    "out",
    "vs",
    "workbench",
    "workbench.desktop.main.css"
);

async function promptRestart(msg) {
    const config = vscode.workspace.getConfiguration();
    const configKey = "update.mode";
    const value = config.inspect(configKey);

    await config.update(
        configKey,
        config.get(configKey) === "default" ? "manual" : "default",
        vscode.ConfigurationTarget.Global
    );
    config.update(
        configKey,
        value?.globalValue,
        vscode.ConfigurationTarget.Global
    );
    vscode.window.showInformationMessage(msg);
}

function applyChecksum() {
    const product = require(productFile);
    let changed = false;
    for (const [filePath, curChecksum] of Object.entries(product.checksums)) {
        const checksum = computeChecksum(
            path.join(appRoot, ...filePath.split("/"))
        );
        if (checksum !== curChecksum) {
            product.checksums[filePath] = checksum;
            changed = true;
        }
    }
    if (changed) {
        const json = JSON.stringify(product, null, "\t");
        try {
            if (!fs.existsSync(origFile)) {
                fs.renameSync(productFile, origFile);
            }
            fs.writeFileSync(productFile, json, { encoding: "utf8" });
        } catch (err) {
            console.error(err);
        }
    }
}

function restoreChecksum() {
    try {
        if (fs.existsSync(origFile)) {
            fs.unlinkSync(productFile);
            fs.renameSync(origFile, productFile);
        }
    } catch (err) {
        console.error(err);
    }
}

function computeChecksum(file) {
    var contents = fs.readFileSync(file);
    return crypto
        .createHash("sha256")
        .update(contents)
        .digest("base64")
        .replace(/=+$/, "");
}

function cleanupOrigFiles() {
    const oldOrigFiles = fs
        .readdirSync(appRoot)
        .filter((file) => /\.orig\./.test(file))
        .filter((file) => !file.endsWith(vscode.version));
    for (const file of oldOrigFiles) {
        fs.unlinkSync(path.join(appRoot, file));
    }
}

function createBackup(filePath) {
    const backupPath = `${filePath}.backup`;
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
    }
}

function restoreFromBackup(filePath, msgShow = true) {
    const backupPath = `${filePath}.backup`;
    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, filePath);
        if (msgShow) {
            promptRestart("Settings restored. Restart VS Code to see changes.");
        }
    } else {
        if (msgShow) {
            vscode.window.showInformationMessage(`Backup files not found`);
        }
    }
}

function activate(context) {
    const enableAnimations = "vscode-animations.enableAnimations";
    const disableAnimations = "vscode-animations.disableAnimations";

    const enableDisposable = vscode.commands.registerCommand(
        enableAnimations,
        async () => {
            restoreFromBackup(workbenchCssPath, false);
            createBackup(workbenchCssPath);

            const animationCSS = `.window-appicon{display:none}.monaco-menu .monaco-action-bar.vertical .action-label,.monaco-menu .monaco-action-bar.vertical .keybinding{height:2em!important;line-height:2em!important}.monaco-icon-label:before{background-size:18px!important;width:18px!important;padding-right:4px!important}.tree-explorer-viewlet-tree-view .monaco-tl-twistie:not(.force-twistie){background-image:none!important;width:0!important;padding-right:0!important;visibility:hidden}.scrollbar.vertical{width:4px!important}.monaco-list .monaco-list-rows{background:0 0!important}.lightBulbWidget{transition:top .2s}.monaco-hover:not(.hidden){animation:.2s hoverFadeIn}@keyframes hoverFadeIn{from{opacity:0}to{opacity:1}}.action-label{transition:color .2s}.monaco-workbench .split-view-view:has(.part.editor),.monaco-workbench .split-view-view:has(.part.sidebar){transition-property:top,left,width,height;transition-duration:.2s}.monaco-workbench:has(iframe) .split-view-view:has(.part.editor),.monaco-workbench:has(iframe) .split-view-view:has(.part.sidebar){transition:none!important}.monaco-workbench .split-view-view:not(.visible):has(.part.sidebar){display:block!important;opacity:0}.quick-input-widget{transform-origin:top;animation:.4s openPopup}.quick-input-widget[style*="display: none;"]{display:block!important;transform-origin:top;animation:.4s closePopup;opacity:0;transform:scaleY(0);pointer-events:none}@keyframes openPopup{from{opacity:0;transform:scaleY(0)}to{opacity:1;transform:scaleY(1)}}@keyframes closePopup{from{opacity:1;transform:scaleY(1)}to{opacity:0;transform:scaleY(0)}}.monaco-list-row:not(.explorer-folders-view .monaco-list-row){animation:.4s scrollingAnimation}@keyframes scrollingAnimation{from{opacity:0}to{opacity:1}}`;

            const cssFileContent = fs.readFileSync(workbenchCssPath, "utf-8");
            const modifiedCssContent = cssFileContent + animationCSS;
            fs.writeFileSync(workbenchCssPath, modifiedCssContent, "utf-8");

            cleanupOrigFiles();
            applyChecksum();
            promptRestart("You must restart VS Code to see animation changes");
        }
    );

    const disableDisposable = vscode.commands.registerCommand(
        disableAnimations,
        () => {
            restoreFromBackup(workbenchCssPath);
            restoreChecksum();
        }
    );

    context.subscriptions.push(enableDisposable, disableDisposable);
}

exports.activate = activate;
