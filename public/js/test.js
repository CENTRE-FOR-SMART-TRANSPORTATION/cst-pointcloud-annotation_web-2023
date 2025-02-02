import * as THREE from "./lib/three.module.js";
//import Stats from './lib/stats.module.js';
import { OrthographicTrackballControls } from "./lib/OrthographicTrackballControls.js";
var camera, controls, scene, renderer, stats;
init();
animate();
function init() {
  camera = new THREE.OrthographicCamera(
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2,
    1,
    2000
  );
  camera.position.z = 1000;
  // world
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcccccc);
  scene.fog = new THREE.FogExp2(0xcccccc, 0.001);
  var geometry = new THREE.CylinderBufferGeometry(0, 10, 30, 4, 1);
  var material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    flatShading: true,
  });
  for (var i = 0; i < 50; i++) {
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = (Math.random() - 0.5) * 1000;
    mesh.position.y = (Math.random() - 0.5) * 1000;
    mesh.position.z = (Math.random() - 0.5) * 1000;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }
  // lights
  var light = new THREE.DirectionalLight(0xffffff);
  light.position.set(1, 1, 1);
  scene.add(light);
  var light = new THREE.DirectionalLight(0x002288);
  light.position.set(-1, -1, -1);
  scene.add(light);
  var light = new THREE.AmbientLight(0x222222);
  scene.add(light);
  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new OrthographicTrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 1.0;
  controls.zoomSpeed = 1.2;
  controls.noZoom = false;
  controls.noPan = false;
  controls.staticMoving = true;
  controls.dynamicDampingFactor = 0.3;
  controls.keys = [65, 83, 68];
  controls.addEventListener("change", render);

  //stats = new Stats();
  //document.body.appendChild( stats.dom );
  //
  window.addEventListener("resize", onWindowResize, false);
  //
  render();
}
function onWindowResize() {
  camera.left = window.innerWidth / -2;
  camera.right = window.innerWidth / 2;
  camera.top = window.innerHeight / 2;
  camera.bottom = window.innerHeight / -2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  controls.handleResize();
  render();
}
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  //stats.update();
}
function render() {
  renderer.render(scene, camera);
}
