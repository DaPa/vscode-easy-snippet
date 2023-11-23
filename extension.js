const vscode = require("vscode");
const path = require("path");
const SnippetNodeProvider = require("./src/SnippetNodeProvider");
const SnippetScopeNodeProvider = require("./src/SnippetScopeNodeProvider");
const utils = require("./common/utils");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	let provider = new SnippetNodeProvider();
	let explorer = vscode.window.createTreeView("snippetExplorer", {treeDataProvider: provider});
	provider.tree = explorer;
	let scope_provider = new SnippetScopeNodeProvider();
	let scope_explorer = vscode.window.createTreeView("snippetScopeExplorer", {
		treeDataProvider: scope_provider,
	});
	scope_provider.tree = scope_explorer;
	scope_provider.refresh();
	context.subscriptions.push(
		// vscode.window.registerTreeDataProvider('snippetExplorer', provider),
		vscode.commands.registerCommand("snippetExplorer.refresh", provider.refresh.bind(provider)),
		vscode.commands.registerCommand("snippetExplorer.search", provider.search.bind(provider)),
		vscode.commands.registerCommand("snippetExplorer.addGroup", provider.addGroup.bind(provider)),
		vscode.commands.registerCommand(
			"snippetExplorer.addSnippet",
			provider.addSnippet.bind(provider)
		),
		vscode.commands.registerCommand("snippetExplorer.editGroup", provider.editGroup.bind(provider)),
		vscode.commands.registerCommand(
			"snippetExplorer.deleteGroup",
			provider.deleteGroup.bind(provider)
		),
		vscode.commands.registerCommand(
			"snippetExplorer.deleteSnippet",
			provider.deleteSnippet.bind(provider)
		),
		vscode.commands.registerCommand(
			"snippetExplorer.editSnippet",
			provider.editSnippet.bind(provider)
		),
		// scope snippets
		vscode.commands.registerCommand(
			"snippetScopeExplorer.refresh",
			scope_provider.refresh.bind(scope_provider)
		),
		vscode.commands.registerCommand(
			"snippetScopeExplorer.search",
			scope_provider.search.bind(scope_provider)
		),
		vscode.commands.registerCommand(
			"snippetScopeExplorer.addGroup",
			scope_provider.addGroup.bind(scope_provider)
		),
		vscode.commands.registerCommand(
			"snippetScopeExplorer.addSnippet",
			scope_provider.addSnippet.bind(scope_provider)
		),
		vscode.commands.registerCommand(
			"snippetScopeExplorer.editGroup",
			scope_provider.editGroup.bind(scope_provider)
		),
		vscode.commands.registerCommand(
			"snippetScopeExplorer.deleteGroup",
			scope_provider.deleteGroup.bind(scope_provider)
		),
		vscode.commands.registerCommand(
			"snippetScopeExplorer.deleteSnippet",
			scope_provider.deleteSnippet.bind(scope_provider)
		),
		vscode.commands.registerCommand(
			"snippetScopeExplorer.editSnippet",
			scope_provider.editSnippet.bind(scope_provider)
		),
		vscode.commands.registerCommand("snippetScopeExplorer.open", function () {
			explorer.reveal(provider.getChildren()[0]);
		}),
		vscode.commands.registerCommand("easySnippet.run", async function () {
			let text = utils.getSelectedText();
			if (!text)
				return vscode.window.showWarningMessage("can't convert to snippet by select nothing");
			if (scope_provider.data.length) {
				let items = [{label: "vscode snippet"}].concat(scope_provider.data);
				let item = await vscode.window.showQuickPick(items, {placeHolder: "select snippet scope"});
				if (!item) return;
				if (item.filepath) {
					scope_provider.addSnippet(item);
					return;
				}
			}
			let label = vscode.window.activeTextEditor.document.languageId;
			provider.addSnippet({label});
		}),
		vscode.workspace.onDidSaveTextDocument(function (e) {
			if (
				e.fileName.endsWith(".json") &&
				e.fileName.toLowerCase().startsWith(utils.vsCodeSnippetsPath.toLowerCase())
			)
				return provider.refresh();
			if (e.fileName.endsWith(".code-snippets"))
				return scope_provider.openFile(e.fileName, e.getText());
			if (e.fileName.endsWith(".snippet")) {
				let name = path.basename(e.fileName, ".snippet");
				let ss = name.split(".");
				if (ss.length != 2) return;
				let key = Buffer.from(ss[0].replace(/-/g, "/"), "base64").toString();
				let languageId = ss[1];
				provider.saveSnippet(languageId, key, e.getText());
				provider.refresh();
			}
			if (e.fileName.endsWith(".scopesnippet")) {
				let name = path.basename(e.fileName, ".scopesnippet");
				let languageId = name.split(".").pop();
				scope_provider.saveSnippet(e.getText(), languageId);
			}
		}),
		vscode.window.onDidChangeActiveTextEditor(function (e) {
			let doc = e.document;
			scope_provider.openFile(doc.fileName, doc.getText());
		})
	);
}
exports.activate = activate;

function deactivate() {
	utils.clearCaches();
}
exports.deactivate = deactivate;
