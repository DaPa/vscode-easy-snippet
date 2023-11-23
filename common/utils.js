const vscode = require("vscode");
const os = require("os");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

let vsCodeUserSettingsPath;
let isInsiders = /insiders/i.test(process.argv0);
let isCodium = /codium/i.test(process.argv0);
let isOSS = /vscode-oss/i.test(__dirname);
let CodeDir = isInsiders
	? "Code - Insiders"
	: isCodium
	? "VSCodium"
	: isOSS
	? "Code - OSS"
	: "Code";
let isPortable = process.env.VSCODE_PORTABLE ? true : false;
if (isPortable) {
	vsCodeUserSettingsPath = process.env.VSCODE_PORTABLE + `/user-data/User/`;
} else {
	switch (os.type()) {
		case "Darwin":
			vsCodeUserSettingsPath = process.env.HOME + `/Library/Application Support/${CodeDir}/User/`;
			break;
		case "Linux":
			vsCodeUserSettingsPath = process.env.HOME + `/.config/${CodeDir}/User/`;
			break;
		case "Windows_NT":
			vsCodeUserSettingsPath = process.env.APPDATA + `\\${CodeDir}\\User\\`;
			break;
		default:
			vsCodeUserSettingsPath = process.env.HOME + `/.config/${CodeDir}/User/`;
			break;
	}
}
exports.vsCodeUserSettingsPath = vsCodeUserSettingsPath;
exports.vsCodeSnippetsPath = path.join(vsCodeUserSettingsPath, "snippets");
let json_caches = {};

function clearCaches() {
	json_caches = {};
}
exports.clearCaches = clearCaches;
function readJson(filename) {
	let cache = json_caches[filename] || {};
	let stat = fs.statSync(filename);
	if (cache && cache.t >= stat.mtime.getTime()) return cache.data;
	let text = fs.readFileSync(filename, "utf8");
	cache.data = new Function("return " + text)();
	cache.t = stat.mtime.getTime();
	json_caches[filename] = cache;
	return cache.data;
}
exports.readJson = readJson;
function getSelectedText() {
	let editor = vscode.window.activeTextEditor;
	let content = editor.document.getText(editor.selection);
	let lines = content.split("\n");
	let minIndent = Infinity;
	for (let line of lines) {
		let indent = line.match(/^\s*/)[0].length;
		if (indent < minIndent) minIndent = indent;
	}
	if (minIndent != Infinity) {
		content = lines.map((x) => x.slice(minIndent)).join("\n");
	}
	return content;
}
exports.getSelectedText = getSelectedText;
function insertContent(content) {
	let editor = vscode.window.activeTextEditor;
	let snippet = {
		"${1:snippet name}": {
			prefix: "${2:$1}",
			body: content.split("\n"),
			description: "${3:$1}",
		},
	};
	let s = JSON.stringify(snippet, null, 4);
	editor.insertSnippet(new vscode.SnippetString(s), editor.selection);
}
exports.insertContent = insertContent;
function endSelection(document) {
	let maxLine = document.lineCount - 1;
	let endChar = document.lineAt(maxLine).range.end.character;
	let position = new vscode.Position(maxLine, endChar);
	return new vscode.Selection(position, position);
}
exports.endSelection = endSelection;
function selectAllRange(document) {
	let maxLine = document.lineCount - 1;
	let endChar = document.lineAt(maxLine).range.end.character;
	return new vscode.Range(0, 0, maxLine, endChar);
}
exports.selectAllRange = selectAllRange;
function getLanguageConfig(languageId) {
	// reference https://github.com/Microsoft/vscode/issues/2871#issuecomment-338364014
	var langConfigFilepath = null;
	for (const _ext of vscode.extensions.all) {
		if (_ext.packageJSON.contributes && _ext.packageJSON.contributes.languages) {
			// Find language data from "packageJSON.contributes.languages" for the languageId
			const packageLangData = _ext.packageJSON.contributes.languages.find(
				(_packageLangData) => _packageLangData.id === languageId
			);
			// If found, get the absolute config file path
			if (packageLangData && packageLangData.configuration) {
				langConfigFilepath = path.join(_ext.extensionPath, packageLangData.configuration);
				break;
			}
		}
	}
	// Validate config file existance
	if (!!langConfigFilepath && fs.existsSync(langConfigFilepath)) {
		return readJson(langConfigFilepath);
	}
}
exports.getLanguageConfig = getLanguageConfig;
/**
 * 获取指定lang的行内注释
 * @param {string} languageId
 * @param {string} [def]
 **/
function getLineComment(languageId, def = "//") {
	let config = getLanguageConfig(languageId);
	if (!config) return def;
	return config.comments.lineComment || def;
}
exports.getLineComment = getLineComment;
async function pickLanguage(filter) {
	let languages = await vscode.languages.getLanguages();
	let currentLanguage =
		vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId;
	let items = languages.map((x) => {
		let description;
		let label = x;
		if (x === currentLanguage) description = "current language";
		return {label, description};
	});
	if (currentLanguage)
		items.sort((a, b) => {
			if (a.description) return -1;
			if (b.description) return 1;
			return a.label > b.label ? -1 : 1;
		});
	if (filter) items = filter(items);
	let item = await vscode.window.showQuickPick(items, {
		placeHolder: "please select snippet language",
	});
	return item && item.label;
}
exports.pickLanguage = pickLanguage;
function snippet2text(snippet, languageId) {
	if (!languageId && snippet.scope) languageId = snippet.scope.split(",")[0];
	let comment = getLineComment(languageId);
	let text = "";
	let keys = ["filepath", "key"].filter((k) => snippet[k]);
	if (keys.length) keys.push("scope");
	keys.push("prefix", "description");
	for (let k of keys) {
		let v = snippet[k] || "";
		for (let item of v.split("\n")) {
			text += `${comment} @${k} ${item}\n`;
			if (k[0] != " ") k = Array.from(k).fill(" ").join();
		}
	}
	if (languageId == "javascript") text += "/* eslint-disable */\n";
	text += "\n";
	if (snippet.body instanceof Array) text += snippet.body.join("\n");
	else text += snippet.body || "";
	return text;
}
exports.snippet2text = snippet2text;
function md5(s) {
	return crypto.createHash("md5").update(s).digest("hex");
}
exports.md5 = md5;
