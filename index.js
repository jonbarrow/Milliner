const fs = require('fs');

const Yaz0 = require('./yaz0');
const SARCArchive = require('./sarc');
const Byaml = require('./byaml');

const SMO_ASSETS_PATH = 'C:/Users/halol/Documents/Games/n/Super.Mario.Odyssey.NSW-BigBlueBox/bbb-h-aaaca/dump/out/secure/out/romf';
const SMO_STAGES = getStages();

ready();

function ready() {
	const decompressed = Yaz0.decompress(fs.readFileSync(`${SMO_ASSETS_PATH}/StageData/${SMO_STAGES[0]}`));
	
	const Stage = new SARCArchive(decompressed);
	const files = Stage.files;

	const yaml = new Byaml(files[0].data);
	console.log(yaml);
}

function getStages() {
	const files = fs.readdirSync(`${SMO_ASSETS_PATH}/StageData`);

	return files.filter(file => {
		return file.slice(-7) == 'Map.szs';
	});
}