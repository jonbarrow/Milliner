const {BrowserWindow, app, ipcMain, dialog} = require('electron');
const fs = require('fs-extra');
const path = require('path');
const url = require('url');

const Yaz0 = require('./yaz0');
const SARCArchive = require('./sarc');
//const Byaml = require('./byaml');
const BFRES = require('./bfres');

let LOCAL_RESOURCES_ROOT;
if (isDev()) {
	require('electron-reload')(__dirname);
	LOCAL_RESOURCES_ROOT = __dirname;
} else {
	LOCAL_RESOURCES_ROOT = `${__dirname}/../`;
}

const DATA_ROOT = app.getPath('userData').replace(/\\/g, '/') + '/app_data';

let ApplicationWindow;

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('ready', () => {
	ApplicationWindow = new BrowserWindow({
		title: 'Milliner',
		icon: `${LOCAL_RESOURCES_ROOT}/icon.ico`,
		minHeight: '300px',
		minWidth: '500px'
	});

	ApplicationWindow.setMenu(null);
	ApplicationWindow.maximize();

	ApplicationWindow.webContents.on('did-finish-load', () => {
		ApplicationWindow.show();
		ApplicationWindow.focus();
	});
		
	ApplicationWindow.loadURL(url.format({
		pathname: path.join(__dirname, '/app/index.html'),
		protocol: 'file:',
		slashes: true
	}));

	ApplicationWindow.on('closed', () => {
		ApplicationWindow = null;
	});

	//ApplicationWindow.webContents.openDevTools();
});

ipcMain.on('initialize', (event) => {
	initialize(event);
});


function initialize(event) {
	event.sender.send('initializing');

	dialog.showMessageBox({
		title: 'Info',
		message: 'This verion of Milliner is in testing.\nThe only thing it does at the moment is display a cactus, which was ripped directly from Super Mario Odyssey.'
	});

	const decompressed = Yaz0.decompress(fs.readFileSync('./Cactus.szs'));
	const archive = new SARCArchive(decompressed);
	const files = archive.files;

	event.sender.send('initialized');

	for (const file of files) {
		if (file.name.slice(-6) == '.bfres') {
			const model = new BFRES(file.data);
			if (model.fmdls[0]) {
				event.sender.send('load_obj', model.export(model.fmdls[0]).obj);
			}
		}
	}
}

// https://github.com/electron/electron/issues/7714#issuecomment-255835799
function isDev() {
	return process.mainModule.filename.indexOf('app.asar') === -1;
}