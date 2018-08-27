/* eslint-env browser */

const ipcRenderer = require('electron').ipcRenderer;

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({
	antialias: true,
	alpha: true
});
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const objectLoader = new THREE.OBJLoader2();
const controls = new THREE.TrackballControls(camera);
let light;

(() => {
	ipcRenderer.send('initialize');
})();

ipcRenderer.on('initialized', () => {
	controls.target.set(0, 0, 0);
	controls.addEventListener('change', render);

	camera.position.z = 500;

	light = new THREE.DirectionalLight(0xffffff);
	light.position.set(1, 1, 1);
	scene.add(light);

	light = new THREE.DirectionalLight(0xffffff);
	light.position.set(-1, -1, -1);
	scene.add(light);

	light = new THREE.AmbientLight(0x222222);
	scene.add(light);

	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize, false);

	animate();
	render();
});

ipcRenderer.on('load_obj', (event, obj) => {
	if (obj) {
		objectLoader.parseAsync(obj, event => {
			const model = event.detail.loaderRootNode;
			// cactus-specific position and rotation stuff
			// only for testing
			model.translateY(-200);
			model.rotateX(degreesToRadians(90));
			model.rotateY(degreesToRadians(90));
			
			scene.add(model);
		});
	}
});

function animate() {
	requestAnimationFrame(animate);
	controls.update();
	render();
}

function render() {
	renderer.render(scene, camera);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

	render();
}

function degreesToRadians(degrees) {
	return degrees * Math.PI / 180;
}