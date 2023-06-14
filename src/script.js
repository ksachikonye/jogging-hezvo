//===================================================== static data
  const randnum = (min, max) => Math.round(Math.random() * (max - min) + min);
  const clock = new THREE.Clock();
  const collidableMeshList = [];//holds collidable item positions to interact with in the scene
  const mixers = [];//holds all animations in the scene
  const opacity = 0;//opacity for the colliders
//=========================================================================================== add tweening
Object.defineProperties(THREE.Object3D.prototype, {
  x: {
    get: function() {
      return this.position.x;
    },
    set: function(v) {
      this.position.x = v;
    }
  },
  y: {
    get: function() {
      return this.position.y;
    },
    set: function(v) {
      this.position.y = v;
    }
  },
  z: {
    get: function() {
      return this.position.z;
    },
    set: function(v) {
      this.position.z = v;
    }
  },
  rotationZ: {
    get: function() {
      return this.rotation.x;
    },
    set: function(v) {
      this.rotation.x = v;
    }
  },
  rotationY: {
    get: function() {
      return this.rotation.y;
    },
    set: function(v) {
      this.rotation.y = v;
    }
  },
  rotationX: {
    get: function() {
      return this.rotation.z;
    },
    set: function(v) {
      this.rotation.z = v;
    }
  }
});





//===================================================== canon
class CannonHelper {
  constructor(scene) {
    this.scene = scene;
  }

  createCannonTrimesh(geometry) {
    if (!geometry.isBufferGeometry) return null;

    const posAttr = geometry.attributes.position;
    const vertices = geometry.attributes.position.array;
    let indices = [];
    for (let i = 0; i < posAttr.count; i++) {
      indices.push(i);
    }

    return new CANNON.Trimesh(vertices, indices);
  }

  createCannonConvex(geometry) {
    if (!geometry.isBufferGeometry) return null;

    const posAttr = geometry.attributes.position;
    const floats = geometry.attributes.position.array;
    const vertices = [];
    const faces = [];
    let face = [];
    let index = 0;
    for (let i = 0; i < posAttr.count; i += 3) {
      vertices.push(new CANNON.Vec3(floats[i], floats[i + 1], floats[i + 2]));
      face.push(index++);
      if (face.length == 3) {
        faces.push(face);
        face = [];
      }
    }

    return new CANNON.ConvexPolyhedron(vertices, faces);
  }

  addVisual(body, name, castShadow = false, receiveShadow = true) {
    body.name = name;
    if (this.currentMaterial === undefined) this.currentMaterial = new THREE.MeshLambertMaterial({
      color: 0x888888,
      wireframe: true,
      transparent: true,
      opacity: 1
    });
    if (this.settings === undefined) {
      this.settings = {
        stepFrequency: 60,
        quatNormalizeSkip: 2,
        quatNormalizeFast: true,
        gx: 0,
        gy: 0,
        gz: 0,
        iterations: 3,
        tolerance: 0.0001,
        k: 1e6,
        d: 3,
        scene: 0,
        paused: false,
        rendermode: "solid",
        constraints: false,
        contacts: false, // Contact points
        cm2contact: false, // center of mass to contact points
        normals: false, // contact normals
        axes: false, // "local" frame axes
        particleSize: 0.1,
        shadows: false,
        aabbs: false,
        profiling: false,
        maxSubSteps: 3
      }
      this.particleGeo = new THREE.SphereGeometry(1, 16, 8);
      this.particleMaterial = new THREE.MeshLambertMaterial({
        color: 0xff0000
      });
    }
    // What geometry should be used?
    let mesh;
    if (body instanceof CANNON.Body) mesh = this.shape2Mesh(body, castShadow, receiveShadow);

    if (mesh) {
      // Add body
      body.threemesh = mesh;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      this.scene.add(mesh);
    }
  }

  shape2Mesh(body, castShadow, receiveShadow) {
    const obj = new THREE.Object3D();
    const material = this.currentMaterial;
    const game = this;
    let index = 0;

    body.shapes.forEach(function(shape) {
      let mesh;
      let geometry;
      let v0, v1, v2;

      switch (shape.type) {

        case CANNON.Shape.types.SPHERE:
          const sphere_geometry = new THREE.SphereGeometry(shape.radius, 8, 8);
          mesh = new THREE.Mesh(sphere_geometry, material);
          break;

        case CANNON.Shape.types.PARTICLE:
          mesh = new THREE.Mesh(particleGeo, particleMaterial);
          const s = this.settings;
          mesh.scale.set(s.particleSize, s.particleSize, s.particleSize);
          break;

        case CANNON.Shape.types.PLANE:
          geometry = new THREE.PlaneGeometry(1000, 1000, 4, 4);
          mesh = new THREE.Object3D();
          const submesh = new THREE.Object3D();

          THREE.ImageUtils.crossOrigin = '';
          var floorMap = THREE.ImageUtils.loadTexture("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTKWDyKwu1FBDQC9h7MDwBaO0FXz4JfhMlvH51JmvpAv3llSJk9");
          floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
          floorMap.repeat.set(250, 250);
          var groundMaterial = new THREE.MeshPhongMaterial({
            color: new THREE.Color('#111'),
            specular: new THREE.Color('black'),
            shininess: 0,
            bumpMap: window.innerWidth > 900 ? floorMap : ''
          });


          const ground = new THREE.Mesh(geometry, groundMaterial);
          ground.scale.set(1, 1, 1);
          submesh.add(ground);

          mesh.add(submesh);
          break;

        case CANNON.Shape.types.BOX:
          const box_geometry = new THREE.BoxGeometry(shape.halfExtents.x * 2,
            shape.halfExtents.y * 2,
            shape.halfExtents.z * 2);
          mesh = new THREE.Mesh(box_geometry, new THREE.MeshLambertMaterial({
            color: 0x888888,
            wireframe: true,
            transparent: true,
            opacity: 0
          }));
          break;

        case CANNON.Shape.types.CONVEXPOLYHEDRON:
          const geo = new THREE.Geometry();

          // Add vertices
          shape.vertices.forEach(function(v) {
            geo.vertices.push(new THREE.Vector3(v.x, v.y, v.z));
          });

          shape.faces.forEach(function(face) {
            // add triangles
            const a = face[0];
            for (let j = 1; j < face.length - 1; j++) {
              const b = face[j];
              const c = face[j + 1];
              geo.faces.push(new THREE.Face3(a, b, c));
            }
          });
          geo.computeBoundingSphere();
          geo.computeFaceNormals();
          mesh = new THREE.Mesh(geo, material);
          break;

        case CANNON.Shape.types.HEIGHTFIELD:
          geometry = new THREE.Geometry();

          v0 = new CANNON.Vec3();
          v1 = new CANNON.Vec3();
          v2 = new CANNON.Vec3();
          for (let xi = 0; xi < shape.data.length - 1; xi++) {
            for (let yi = 0; yi < shape.data[xi].length - 1; yi++) {
              for (let k = 0; k < 2; k++) {
                shape.getConvexTrianglePillar(xi, yi, k === 0);
                v0.copy(shape.pillarConvex.vertices[0]);
                v1.copy(shape.pillarConvex.vertices[1]);
                v2.copy(shape.pillarConvex.vertices[2]);
                v0.vadd(shape.pillarOffset, v0);
                v1.vadd(shape.pillarOffset, v1);
                v2.vadd(shape.pillarOffset, v2);
                geometry.vertices.push(
                  new THREE.Vector3(v0.x, v0.y, v0.z),
                  new THREE.Vector3(v1.x, v1.y, v1.z),
                  new THREE.Vector3(v2.x, v2.y, v2.z)
                );
                var i = geometry.vertices.length - 3;
                geometry.faces.push(new THREE.Face3(i, i + 1, i + 2));
              }
            }
          }
          geometry.computeBoundingSphere();
          geometry.computeFaceNormals();

          //https://stackoverflow.com/questions/52614371/apply-color-gradient-to-material-on-mesh-three-js
        var rev = true;
        //@TODO switch out with a function
        var cols = [{
          stop: 0,
          color: new THREE.Color('white')
        }, {
          stop: .25,
          color: new THREE.Color('#CD853F')
        }, {
          stop: .5,
          color: new THREE.Color('#EEE8AA')
        }, {
          stop: .75,
          color: new THREE.Color('#ccc')
        }, {
          stop: 1,
          color: new THREE.Color('#24282c')
        }];

        setGradient(geometry, cols, 'z', rev);

        function setGradient(geometry, colors, axis, reverse) {

          geometry.computeBoundingBox();

          var bbox = geometry.boundingBox;
          var size = new THREE.Vector3().subVectors(bbox.max, bbox.min);

          var vertexIndices = ['a', 'b', 'c'];
          var face, vertex, normalized = new THREE.Vector3(),
            normalizedAxis = 0;

          for (var c = 0; c < colors.length - 1; c++) {

            var colorDiff = colors[c + 1].stop - colors[c].stop;

            for (var i = 0; i < geometry.faces.length; i++) {
              face = geometry.faces[i];
              for (var v = 0; v < 3; v++) {
                vertex = geometry.vertices[face[vertexIndices[v]]];
                normalizedAxis = normalized.subVectors(vertex, bbox.min).divide(size)[axis];
                if (reverse) {
                  normalizedAxis = 1 - normalizedAxis;
                }
                if (normalizedAxis >= colors[c].stop && normalizedAxis <= colors[c + 1].stop) {
                  var localNormalizedAxis = (normalizedAxis - colors[c].stop) / colorDiff;
                  face.vertexColors[v] = colors[c].color.clone().lerp(colors[c + 1].color, localNormalizedAxis);
                }
              }
            }
          }
        }

   /*     var mat = new THREE.MeshLambertMaterial({
          vertexColors: THREE.VertexColors,
          wireframe: false
        });*/



        //Set a different color on each face
        for (var i = 0, j = geometry.faces.length; i < j; i++) {
          geometry.faces[i].color = new THREE.Color(
            "hsl(" + Math.floor(Math.random() * 360) + ",50%,50%)"
          );
        }

        var mat = new THREE.MeshLambertMaterial({
          side: THREE.BackSide,
          vertexColors: THREE.FaceColors,
          side: THREE.DoubleSide,
          wireframe: false,
        });
          mesh = new THREE.Mesh(geometry, mat);
          break;

        case CANNON.Shape.types.TRIMESH:
          geometry = new THREE.Geometry();

          v0 = new CANNON.Vec3();
          v1 = new CANNON.Vec3();
          v2 = new CANNON.Vec3();
          for (let i = 0; i < shape.indices.length / 3; i++) {
            shape.getTriangleVertices(i, v0, v1, v2);
            geometry.vertices.push(
              new THREE.Vector3(v0.x, v0.y, v0.z),
              new THREE.Vector3(v1.x, v1.y, v1.z),
              new THREE.Vector3(v2.x, v2.y, v2.z)
            );
            var j = geometry.vertices.length - 3;
            geometry.faces.push(new THREE.Face3(j, j + 1, j + 2));
          }
          geometry.computeBoundingSphere();
          geometry.computeFaceNormals();
          mesh = new THREE.Mesh(geometry, MutationRecordaterial);
          break;

        default:
          throw "Visual type not recognized: " + shape.type;
      }

      mesh.receiveShadow = receiveShadow;
      mesh.castShadow = castShadow;

      mesh.traverse(function(child) {
        if (child.isMesh) {
          child.castShadow = castShadow;
          child.receiveShadow = receiveShadow;
        }
      });

      var o = body.shapeOffsets[index];
      var q = body.shapeOrientations[index++];
      mesh.position.set(o.x, o.y, o.z);
      mesh.quaternion.set(q.x, q.y, q.z, q.w);

      obj.add(mesh);
    });

    return obj;
  }

  updateBodies(world) {
    world.bodies.forEach(function(body) {
      if (body.threemesh != undefined) {
        body.threemesh.position.copy(body.position);
        body.threemesh.quaternion.copy(body.quaternion);
      }
    });
  }
} //end canon helper


//===================================================== joystick

class JoyStick {
  constructor(options) {
    const circle = document.createElement("div");
    circle.style.cssText = "position:absolute; bottom:35px; width:80px; height:80px; background:rgba(126, 126, 126, 0.5); border:#444 solid medium; border-radius:50%; left:50%; transform:translateX(-50%);";
    const thumb = document.createElement("div");
    thumb.style.cssText = "position: absolute; left: 20px; top: 20px; width: 40px; height: 40px; border-radius: 50%; background: #fff;";
    circle.appendChild(thumb);
    document.body.appendChild(circle);
    this.domElement = thumb;
    this.maxRadius = options.maxRadius || 40;
    this.maxRadiusSquared = this.maxRadius * this.maxRadius;
    this.onMove = options.onMove;
    this.game = options.game;
    this.origin = {
      left: this.domElement.offsetLeft,
      top: this.domElement.offsetTop
    };
    this.rotationDamping = options.rotationDamping || 0.06;
    this.moveDamping = options.moveDamping || 0.01;
    if (this.domElement != undefined) {
      const joystick = this;
      if ('ontouchstart' in window) {
        this.domElement.addEventListener('touchstart', function(evt) {
          joystick.tap(evt);
        });
      } else {
        this.domElement.addEventListener('mousedown', function(evt) {
          joystick.tap(evt);
        });
      }
    }
  }

  getMousePosition(evt) {
    let clientX = evt.targetTouches ? evt.targetTouches[0].pageX : evt.clientX;
    let clientY = evt.targetTouches ? evt.targetTouches[0].pageY : evt.clientY;
    return {
      x: clientX,
      y: clientY
    };
  }

  tap(evt) {
    evt = evt || window.event;
    // get the mouse cursor position at startup:
    this.offset = this.getMousePosition(evt);
    const joystick = this;
    if ('ontouchstart' in window) {
      document.ontouchmove = function(evt) {
        joystick.move(evt);
      };
      document.ontouchend = function(evt) {
        joystick.up(evt);
      };
    } else {
      document.onmousemove = function(evt) {
        joystick.move(evt);
      };
      document.onmouseup = function(evt) {
        joystick.up(evt);
      };
    }
  }

  move(evt) {
    evt = evt || window.event;
    const mouse = this.getMousePosition(evt);
    // calculate the new cursor position:
    let left = mouse.x - this.offset.x;
    let top = mouse.y - this.offset.y;
    //this.offset = mouse;

    const sqMag = left * left + top * top;
    if (sqMag > this.maxRadiusSquared) {
      //Only use sqrt if essential
      const magnitude = Math.sqrt(sqMag);
      left /= magnitude;
      top /= magnitude;
      left *= this.maxRadius;
      top *= this.maxRadius;
    }
    // set the element's new position:
    this.domElement.style.top = `${top + this.domElement.clientHeight/2}px`;
    this.domElement.style.left = `${left + this.domElement.clientWidth/2}px`;

    const forward = -(top - this.origin.top + this.domElement.clientHeight / 2) / this.maxRadius;
    const turn = (left - this.origin.left + this.domElement.clientWidth / 2) / this.maxRadius;

    if (this.onMove != undefined) this.onMove.call(this.game, forward, turn);
  }

  up(evt) {
    if ('ontouchstart' in window) {
      document.ontouchmove = null;
      document.touchend = null;
    } else {
      document.onmousemove = null;
      document.onmouseup = null;
    }
    this.domElement.style.top = `${this.origin.top}px`;
    this.domElement.style.left = `${this.origin.left}px`;

    this.onMove.call(this.game, 0, 0);
  }
} //end joystick
//===================================================== canvas
 //THREE.WebGLRenderer.info.render.calls //will tell you numbers of draws. Changing color does not effect it.
  var renderer = new THREE.WebGLRenderer({ alpha: true, antialiase: true, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true;// Shadow
  renderer.shadowMapSoft = true; // Shadow
  renderer.shadowMapType = THREE.PCFShadowMap; //Shadow

  renderer.outputEncoding = THREE.sRGBEncoding;//Sky
  renderer.toneMapping = THREE.ACESFilmicToneMapping;//Sky
  renderer.toneMappingExposure = 0.5;//Sky

  document.body.appendChild( renderer.domElement );
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  //===================================================== scene
  var scene = new THREE.Scene();
  var helper = new CannonHelper(scene);
  var joystick = new JoyStick({
    game: this,
    onMove: joystickCallback
  });
  //scene.fog = new THREE.FogExp2( new THREE.Color("#000"), 0.02 );

  //===================================================== camera
  var camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;
  camera.position.y = 1.5;
  camera.position.x = -.25;


  //===================================================== resize
  window.addEventListener("resize", function() {
    let width = window.innerWidth;
    let height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });


//=====================================================  sky shader
  sky = new THREE.Sky();
  sky.scale.setScalar( 450000 );
  scene.add( sky );

  // Add Sun Helper
  sunSphere = new THREE.Mesh(
    new THREE.SphereBufferGeometry( 20000, 16, 8 ),
    new THREE.MeshBasicMaterial( { color: 0xffffff } )
  );
  sunSphere.position.y = - 700000;
  sunSphere.visible = false;
  scene.add( sunSphere );

  /// GUI

  var effectController  = {
    turbidity: 0, // 0 - 20
    rayleigh: 4,//0 - 4
    inclination: 0.529, // 0 - 1
    azimuth: 0.3773, // 0 - 1,
    sun: ! true
  };
 
/*  var effectController  = {
    turbidity: 0, // 0 - 20
    rayleigh: 0.165,//0 - 4
    inclination: 0, // 0 - 1
    azimuth: 0.9, // 0 - 1,
    sun: ! true
  };
*/
  var distance = 400000;

  function guiChanged() {

    var uniforms = sky.material.uniforms;
    uniforms.turbidity.value = effectController.turbidity;
    uniforms.rayleigh.value = effectController.rayleigh;
   
    var theta = Math.PI * ( effectController.inclination - 0.5 );
    var phi = 2 * Math.PI * ( effectController.azimuth - 0.5 );

    sunSphere.position.x = distance * Math.cos( phi );
    sunSphere.position.y = distance * Math.sin( phi ) * Math.sin( theta );
    sunSphere.position.z = distance * Math.sin( phi ) * Math.cos( theta );

    sunSphere.visible = effectController.sun;

    uniforms.sunPosition.value.copy( sunSphere.position );

    renderer.render( scene, camera );

  }

  var gui = new dat.GUI();

  gui.close();
  gui.add( effectController, "turbidity", 1.0, 20.0, 0.1 ).onChange( guiChanged );
  gui.add( effectController, "rayleigh", 0.0, 4, 0.001 ).onChange( guiChanged );
  //gui.add( effectController, "luminance", 0.0, 2 ).onChange( guiChanged );
  gui.add( effectController, "inclination", 0, 1, 0.0001 ).onChange( guiChanged );
  gui.add( effectController, "azimuth", 0, 1, 0.0001 ).onChange( guiChanged );
  gui.add( effectController, "sun" ).onChange( guiChanged );


  guiChanged();



//==================================================== physics
var physics = {};
const world = new CANNON.World();

world.broadphase = new CANNON.SAPBroadphase(world);
world.gravity.set(0, -10, 0);
world.defaultContactMaterial.friction = 0;

const groundMaterial = new CANNON.Material("groundMaterial");
const wheelMaterial = new CANNON.Material("wheelMaterial");
const wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
  friction: 0,
  restitution: 0,
  contactEquationStiffness: 1000
});

// We must add the contact materials to the world
world.addContactMaterial(wheelGroundContactMaterial);







//===================================================== add Terrain
var sizeX = 128, sizeY = 128, minHeight = 0, maxHeight = 100;
var startPosition = new CANNON.Vec3( 0, maxHeight - 3, sizeY * 0.5 - 10 );
var img2matrix = function () {
  'use strict';
  return {fromImage: fromImage,fromUrl  : fromUrl}

  function fromImage ( image, width, depth, minHeight, maxHeight ) {
    width = width|0;
    depth = depth|0;

    var i, j;
    var matrix = [];
    var canvas = document.createElement( 'canvas' ),
        ctx = canvas.getContext( '2d' );
    var imgData, pixel, channels = 4;
    var heightRange = maxHeight - minHeight;
    var heightData;

    canvas.width  = width;
    canvas.height = depth;

    // document.body.appendChild( canvas );
    ctx.drawImage( image, 0, 0, width, depth );
    imgData = ctx.getImageData( 0, 0, width, depth ).data;

    for ( i = 0|0; i < depth; i = ( i + 1 )|0 ) { //row
      matrix.push( [] );

      for ( j = 0|0; j < width; j = ( j + 1 )|0 ) { //col
        pixel = i * depth + j;
        heightData = imgData[ pixel * channels ] / 255 * heightRange + minHeight;
        matrix[ i ].push( heightData );
      }
    }
    return matrix;
  }
//===================================================== convert heightmap image
  function fromUrl ( url, width, depth, minHeight, maxHeight ) {
    return function () {
      return new Promise( function( onFulfilled, onRejected ) {
        var image = new Image();
        image.crossOrigin = "anonymous";

        image.onload = function () {
          var matrix = fromImage( image, width, depth, minHeight, maxHeight );
          onFulfilled( matrix );
        };
        image.src = url;
      });
    }
  }
}();
//===================================================== get terrain from image
Promise.all( [
  img2matrix.fromUrl( 'https://raw.githubusercontent.com/baronwatts/images/master/singapore-grand-pix.png', sizeX, sizeY, minHeight, maxHeight )(),
] ).then( function ( data ) {

    var matrix = data[ 0 ];
  //console.log(matrix);
    const terrainShape = new CANNON.Heightfield(matrix, {elementSize: 10});
    const terrainBody = new CANNON.Body({mass: 0});

    terrainBody.addShape(terrainShape);
    terrainBody.position.set(-sizeX * terrainShape.elementSize / 2, -.005, sizeY * terrainShape.elementSize / 2);
    terrainBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.add(terrainBody);
    helper.addVisual(terrainBody, 'landscape');
        
});//end Promise


  //===================================================== add floor for shadow reflection
  THREE.ImageUtils.crossOrigin = '';
  var floorMap = THREE.ImageUtils.loadTexture( "https://as1.ftcdn.net/v2/jpg/00/91/31/94/500_F_91319454_PprBvmyn6jNXarEYF8OHhTdFJM8uBupR.jpg" );
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
  floorMap.repeat.set( 50, 50 );


  var meshFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(200,200),
    new THREE.MeshPhongMaterial({color: new THREE.Color('#24282c'), specular: new THREE.Color('#222'), shininess: 0, bumpMap: floorMap })
    //new THREE.MeshLambertMaterial({color: new THREE.Color('#24282c') })
  );
  meshFloor.rotation.x -= Math.PI / 2;
  meshFloor.receiveShadow = true;
  scene.add(meshFloor);


//===================================================== model by  @swift502
  var geometry = new THREE.BoxBufferGeometry( .5, 1, .5 );
  //We change the pivot point to be at the bottom of the cube, instead of its center. So we translate the whole geometry. 
  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
  var material = new THREE.MeshNormalMaterial({transparent: true,opacity:opacity});
  var mesh = new THREE.Mesh( geometry, material );
  scene.add( mesh );
  collidableMeshList.push(mesh);



  var loader = new THREE.GLTFLoader();
  loader.load(
    "https://raw.githubusercontent.com/baronwatts/models/master/girl-run.glb", function(gltf) {

       gltf.scene.traverse( function( node ) {
          if ( node instanceof THREE.Mesh ) { 
            node.castShadow = true; 
            node.material.side = THREE.DoubleSide;
          }
        });

       
      var model = gltf.scene;
      model.scale.set(1.5,1.5,1.5);
      mesh.add(model);
     

      //console.log(gltf.animations); //shows all animations imported into the dopesheet in blender
      var mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(gltf.animations[0]).play();
      mixers.push(mixer);

    
  });




  //===================================================== model by @quaternius
  var dogemesh = new THREE.Mesh( geometry, material );
  scene.add(dogemesh);
  collidableMeshList.push(dogemesh);
  var loader = new THREE.GLTFLoader();
  loader.load(
    "https://raw.githubusercontent.com/baronwatts/models/master/ShibaInu.gltf", function(gltf) {

       gltf.scene.traverse( function( node ) {
          if ( node instanceof THREE.Mesh ) { 
            node.castShadow = true; 
            node.material.side = THREE.DoubleSide;
          }
        });

       
      var model = gltf.scene;
      model.scale.set(.35,.35,.35);
      dogemesh.add(model);
  

      console.log(gltf.animations); //shows all animations imported into the dopesheet in blender
      var mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(gltf.animations[3]).play();
      mixers.push(mixer);
 
  });







  //===================================================== model
  var geometry = new THREE.BoxBufferGeometry( .5, 1, .5 );
 /* We change the pivot point to be at the bottom of the cube, instead of its center. So we translate the whole geometry. */
  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
  var material = new THREE.MeshNormalMaterial({transparent: true,opacity:opacity});
  var birdmesh = new THREE.Mesh( geometry, material );
  scene.add(birdmesh);
  //collidableMeshList.push(birdmesh);

  var loader = new THREE.GLTFLoader();
  loader.load(
    "https://raw.githubusercontent.com/baronwatts/models/master/birdfly.glb", function(gltf) {

       gltf.scene.traverse( function( node ) {
          if ( node instanceof THREE.Mesh ) { 
            node.castShadow = true; 
            node.material.side = THREE.DoubleSide;
          }
        });

      var model = gltf.scene;
      model.scale.set(1.5,1.5,1.5);
      model.position.set(0,0,0);
      model.rotateY(-Math.PI/2);
      birdmesh.add(model);

      
      //console.log(gltf.animations); //shows all animations imported into the dopesheet in blender
      var mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(gltf.animations[0]).play();
      mixers.push(mixer);

    
  });



//===================================================== add model
loader =  new THREE.LegacyJSONLoader();
loader.load('https://raw.githubusercontent.com/baronwatts/models/master/cabin.js', function (geometry, materials) {
  var matt = new THREE.MeshPhongMaterial({ vertexColors: THREE.FaceColors, side: THREE.DoubleSide });
  var model = new THREE.Mesh(geometry, materials);
  model.castShadow = true;
  model.scale.set(10,10,10);
  model.position.set(0,0,0);
  model.rotateY(-Math.PI/2);
  model.matrixAutoUpdate  = false;//won't move in the scene
  model.updateMatrix();//won't move in the scene
  scene.add(model );


  //spread light trick
  var geometry = new THREE.BoxBufferGeometry( .5, 1, .5 );
  //We change the pivot point to be at the bottom of the cube, instead of its center. So we translate the whole geometry. 
  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
  var material = new THREE.MeshNormalMaterial({transparent: true,opacity:opacity});
  var follow_light = new THREE.Mesh( geometry, material );
  follow_light.position.z = model.position.z;
  scene.add(follow_light);
  collidableMeshList.push(follow_light);


  var light_distance = 15;
  var light_angle = -Math.PI;//turn ligh upward. use red as danger/flame/fire area. default is Math.PI/3
  var light = new THREE.SpotLight( new THREE.Color('orange'), 2, light_distance, light_angle );
  light.position.set( 0, 1, 0 );  
  light.castShadow = true; 
  light.target = follow_light;//light will point to this target  
  follow_light.add( light );

});





//===================================================== add model
var checkpoint = new THREE.Object3D();
checkpoint.position.x = -30;
checkpoint.position.z = -30;
scene.add(checkpoint);
loader =  new THREE.LegacyJSONLoader();
loader.load('https://raw.githubusercontent.com/baronwatts/models/master/crib.js', function (geometry, materials) {
  var model = new THREE.Mesh(geometry, materials);
  model.castShadow = true;
  model.scale.set(.25,.25,.25);
  model.position.set(0,0,0);
  //model.rotateY(-Math.PI/2);
  model.matrixAutoUpdate  = false;//won't move in the scene
  model.updateMatrix();//won't move in the scene
  checkpoint.add(model );

  //spread light trick
  var geometry = new THREE.BoxBufferGeometry( .5, 1, .5 );
  //We change the pivot point to be at the bottom of the cube, instead of its center. So we translate the whole geometry. 
  geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.5, 0));
  var material = new THREE.MeshNormalMaterial({transparent: true,opacity:opacity});
  var follow_light = new THREE.Mesh( geometry, material );
  follow_light.position.z = model.position.z + 15;
  checkpoint.add(follow_light);
  collidableMeshList.push(follow_light);


  var light_distance = 15;
  var light_angle = -Math.PI;//turn ligh upward. use red as danger/flame/fire area. default is Math.PI/3
  var light = new THREE.SpotLight( new THREE.Color('green'), 2, light_distance, light_angle );
  light.position.set( 0, 1, 0 );  
  light.castShadow = true; 
  light.target = follow_light;//light will point to this target  
  follow_light.add( light );

});




//===================================================== curve points exported from blender using python script
var scale = 20;
var points = [
[0.846197783946991, 0.9487326145172119, 0.0] ,
[1.1449017524719238, 0.5, 0.0] ,
[1.1411281824111938, 0.0, 0.0] ,
[1.0411568880081177, -0.49216699600219727, 0.0] ,
[0.8642842769622803, -0.9843339920043945, 0.0] ,
[0.32597658038139343, -1.2124738693237305, 0.0] ,
[-0.2123311161994934, -1.1740233898162842, 0.0] ,
[-0.5455693006515503, -1.0279113054275513, 0.0] ,
[-0.8788074254989624, -0.758757472038269, 0.0] ,
[-1.047989845275879, -0.3434915542602539, 0.0] ,
[-1.104383945465088, 0.07177436351776123, 0.0] ,
[-1.0197927951812744, 0.40501242876052856, 0.0] ,
[-0.8736807107925415, 0.7382504940032959, 0.0] ,
[-0.7275686264038086, 0.9715171456336975, 0.0] ,
[-0.519935667514801, 1.1125024557113647, 0.0] ,
[-0.15593716502189636, 1.184276819229126, 0.0] ,
[0.2080613374710083, 1.2099106311798096, 0.0] ,
[0.4643983244895935, 1.1509531736373901, 0.0] ,
[0.7258620262145996, 1.0509816408157349, 0.0] ,
[0.7834665775299072, 1.0588146448135376, 0.0] ,
];



var points = [

[0.1475604772567749, -0.712435245513916, 0.0] ,
[-0.29813435673713684, -1.0560625791549683, 0.0] ,
[-0.7438291907310486, -1.3996899127960205, 0.0] ,
[-1.1895240545272827, -1.7433172464370728, 0.0] ,
[-1.635218858718872, -2.086944580078125, 0.0] ,
[-1.4821176528930664, -2.3931469917297363, 0.0] ,
[-1.3290163278579712, -2.6993496417999268, 0.0] ,
[-1.175915002822876, -3.005552291870117, 0.0] ,
[-1.0228137969970703, -3.3117547035217285, 0.0] ,
[-0.577118992805481, -3.3015480041503906, 0.0] ,
[-0.13142412900924683, -3.2913413047790527, 0.0] ,
[0.3142707049846649, -3.281134605407715, 0.0] ,
[0.7599655389785767, -3.270927667617798, 0.0] ,
[0.8824465870857239, -2.883070945739746, 0.0] ,
[1.004927635192871, -2.4952144622802734, 0.0] ,
[1.1274086236953735, -2.107357978820801, 0.0] ,
[1.249889612197876, -1.7195013761520386, 0.0] ,
[0.9200997352600098, -1.5160489082336426, 0.0] ,
[0.5903098583221436, -1.3125964403152466, 0.0] ,
[0.26051998138427734, -1.1091439723968506, 0.0] ,
[-0.06926989555358887, -0.9056915640830994, 0.0] ,
[-0.42695242166519165, -0.6792686581611633, 0.0] ,
[-0.7846349477767944, -0.4528457820415497, 0.0] ,
[-1.142317533493042, -0.22642289102077484, 0.0] ,
[-1.5, 0.0, 0.0] ,
[-1.375, 0.25, 0.0] ,
[-1.25, 0.5, 0.0] ,
[-1.125, 0.75, 0.0] ,
[-1.0, 1.0, 0.0] ,
[-0.5, 1.0, 0.0] ,
[0.0, 1.0, 0.0] ,
[0.5, 1.0, 0.0] ,
[1.0, 1.0, 0.0] ,
[1.125, 0.75, 0.0] ,
[1.25, 0.5, 0.0] ,
[1.375, 0.25, 0.0] ,
[1.5, 0.0, 0.0] ,
[1.2686469554901123, -0.1258832812309265, 0.0] ,
[1.0372939109802246, -0.251766562461853, 0.0] ,
[0.8059408664703369, -0.37764984369277954, 0.0] ,
[0.574587881565094, -0.503533124923706, 0.0] ,
[0.467831015586853, -0.5557586550712585, 0.0] ,
[0.36107417941093445, -0.607984185218811, 0.0] ,
[0.25431734323501587, -0.6602097153663635, 0.0] ,

];

//Convert the array of points into vertices
for (var i = 0; i < points.length; i++) {
  var x = points[i][0] * scale;
  var y = points[i][1] * scale;
  var z = points[i][2] * scale;
  points[i] = new THREE.Vector3(x, z, -y);
}

//Create a path from the points
var carPath = new THREE.CatmullRomCurve3(points);
carPath.closed = true;
var radius = .5;

var geometry = new THREE.TubeGeometry(carPath, 600, radius, 3, false);

//Set a different color on each face
for (var i = 0, j = geometry.faces.length; i < j; i++) {
  geometry.faces[i].color = new THREE.Color(
    "hsl(" + Math.floor(Math.random() * 40) + ",50%,50%)"
  );
}

var material = new THREE.MeshLambertMaterial({
  side: THREE.BackSide,
  vertexColors: THREE.FaceColors,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 1
});
var tube = new THREE.Mesh(geometry, material);
tube.matrixAutoUpdate  = false;//won't move in the scene
tube.updateMatrix();//won't move in the scene
//scene.add( tube );





//===================================================== add model
var list = [];
var loader = new THREE.LegacyJSONLoader();
loader.load('https://raw.githubusercontent.com/baronwatts/models/master/tree-autumn.js', function (geometry, materials) {

  var model = new THREE.Mesh(geometry, materials);
  model.castShadow = true;
  model.rotateY(Math.PI/randnum(0,4));
  var clone;
  var clone2;


  for(var i = 0; i < carPath.points.length; i ++){

    var offsetBy = 1.2;
    var x = carPath.points[i].x/ offsetBy;
    var y = carPath.points[i].y;
    var z = carPath.points[i].z/ offsetBy;

    
   
    clone = model.clone();
    clone.position.set(x,y,z);
    clone.rotateY(Math.PI/randnum(0,4));
    clone.scale.set(randnum(1.5,2),randnum(1.5,2),randnum(1.5,2));
    clone.lookAt(scene.position);
    list.push(clone);
    scene.add(clone);

  }


  list.map((d,i)=>{
    var offsetBy = .95;
    var x2 = carPath.points[i].x/ offsetBy;
    var y2 = carPath.points[i].y;
    var z2 = carPath.points[i].z/ offsetBy;

    clone2 = d.clone();
    clone2.position.set(x2,y2,z2);
    d.rotateY(Math.PI/randnum(0,4));
    scene.add(clone2);

  });

});











//===================================================== add model
var list2 = [];
var loader = new THREE.LegacyJSONLoader();
loader.load('https://raw.githubusercontent.com/baronwatts/models/master/grass-patch.js', function (geometry, materials) {


  var m = new THREE.MeshLambertMaterial({color: new THREE.Color('#FFA500') });
  var model = new THREE.Mesh(geometry, m);
  model.castShadow = true;
  var clone3;
  var clone4;


  for(var i = 0; i < carPath.points.length; i ++){

    var offsetBy = 1.2;
    var x = carPath.points[i].x/ offsetBy;
    var y = carPath.points[i].y;
    var z = carPath.points[i].z/ offsetBy;

    clone3 = model.clone();
    clone3.position.set(x,y,z);
    clone3.scale.set(2,2,2);
    clone3.lookAt(scene.position);
    list2.push(clone3);
    scene.add(clone3);

  }


  list2.map((d,i)=>{
    var offsetBy = .95;
    var x2 = carPath.points[i].x/ offsetBy;
    var y2 = carPath.points[i].y;
    var z2 = carPath.points[i].z/ offsetBy;

    var clone4 = d.clone();
    clone4.position.set(x2,y2,z2);
    d.rotateY(Math.PI/randnum(0,2));
    scene.add(clone4);

  });

});


//===================================================== add model
//forrest-path.js
//forrest-path.js
//log.js
//mushroom.js
//target2
//tree-bundle.js
//tree1
//blocks2

//===================================================== add model
//plastic-cup.js
var collider = new THREE.Object3D();
var loader =  new THREE.LegacyJSONLoader();
loader.load('https://raw.githubusercontent.com/baronwatts/models/master/pond.js', function (geometry, materials) {
  var matt = new THREE.MeshPhongMaterial({ vertexColors: THREE.FaceColors, side: THREE.DoubleSide,/*color: new THREE.Color( "white" )*/ });
  collider = new THREE.Mesh(geometry, materials);
  collider.castShadow = true;
  collider.scale.set(1,1,1);

  var pathPos = carPath.getPointAt(.80);
  collider.position.set(pathPos.x,pathPos.y,pathPos.z);
  collider.rotateY(Math.PI/2)
  scene.add(collider );
});



 //===================================================== add model
 var pathPos = carPath.getPointAt(.80);
  var gzap = new THREE.Object3D();
  gzap.position.set(pathPos.x,pathPos.y,pathPos.z);
  scene.add(gzap);
  var leafs = [];
  loader = new THREE.LegacyJSONLoader();
  loader.load('https://raw.githubusercontent.com/baronwatts/models/master/tree-autumn-leaf.js', function(geometry, materials) {

    //create leaf to be cloned
    var matt = new THREE.MeshLambertMaterial({transparent: true,opacity: 1,side: THREE.DoubleSide,color: new THREE.Color('#FFA500')});
    var particle = new THREE.Mesh(geometry, matt);
    particle.position.set(randnum(0, randnum(10, 50)), 20, randnum(0, 50));
    particle.scale.set(1, 1, 1);
    particle.rotateY(Math.random() * 180);
    

    //create leafs
    new Array(500).fill(null).map( (d, i) => {
      var clone = particle.clone();
      clone.material.color = (i % 2 == 0 ? new THREE.Color('red') : new THREE.Color('#FFA500')); //@TODO CHANGE INDIVIDUAL COLORS
      clone.position.set(randnum(0, randnum(10, 50)), 20, randnum(0, 50));
      clone.scale.set(1, 1, 1);
      clone.rotateY(Math.random() * 180);
      leafs.push(clone)
      gzap.add(clone);
    });

    leafs.map((d, i) => {
      //position
      if (i % 3 == 0) {
        leafs[i].position.y = 0;
      } else {
        TweenMax.to(leafs[i].position, 10, {
          y: 0,
          x: randnum(0, 50),
          ease: Power2.Linear,
          delay: 0.025 * i,
          repeat: -1
        }, 1);
      }
      //rotation
      if (i % 2 == 0) {
        leafs[i].rotation.y = 0;
      } else {
        TweenMax.to(leafs[i], 5, {
          rotationY: '+=25',
          ease: Power2.Linear,
          delay: 0.025 * i,
          repeat: -1
        }, 1);
      }

    }); //end leafs

  });


//===================================================== position system particles as a whole
/*TweenMax.to(gzap.position, 10, {
          y: 0,
          x: collider.position.x,
          z: collider.position.z,
          ease: Power2.Linear,
        }, 1);
*/
 


//===================================================== vehicle
const chassisShape = new CANNON.Box(new CANNON.Vec3(1.5, 0.5, 3.5));
const chassisBody = new CANNON.Body({
  mass: 150,
  material: groundMaterial
});
chassisBody.addShape(chassisShape);
chassisBody.position.set(10, 10, -8);
helper.addVisual(chassisBody, 'car');




var loader = new THREE.LegacyJSONLoader();
loader.load('https://raw.githubusercontent.com/baronwatts/models/master/rv.js', function(geometry, materials) {
  var model = new THREE.Mesh(geometry, materials);
  model.rotateY(Math.PI);
  model.geometry.center();
  model.scale.set(1,1,1);
  model.castShadow = true;
  chassisBody.threemesh.add(model);
});




const options = {
  radius: 0.5,
  directionLocal: new CANNON.Vec3(0, -1, 0),
  suspensionStiffness: 30,
  suspensionRestLength: 0.3,
  frictionSlip: .05,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4,
  maxSuspensionForce: 100000,
  rollInfluence: 0.01,
  axleLocal: new CANNON.Vec3(-1, 0, 0),
  chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
  maxSuspensionTravel: 0.3,
  customSlidingRotationalSpeed: -30,
  useCustomSlidingRotationalSpeed: true
};

// Create the vehicle
const vehicle = new CANNON.RaycastVehicle({
  chassisBody: chassisBody,
  indexRightAxis: 0,
  indexUpAxis: 1,
  indexForwardAxis: 2
});


//back wheels
const axlewidth = 0.8; const frontwheel = -1.75; const backwheel = 1;
options.chassisConnectionPointLocal.set(axlewidth, -.9, backwheel);
vehicle.addWheel(options);

options.chassisConnectionPointLocal.set(-axlewidth, -.9, backwheel);
vehicle.addWheel(options);

options.chassisConnectionPointLocal.set(axlewidth, -.9, frontwheel);
vehicle.addWheel(options);

options.chassisConnectionPointLocal.set(-axlewidth, -.9, frontwheel);
vehicle.addWheel(options);

vehicle.addToWorld(world);

const wheelBodies = [];
vehicle.wheelInfos.forEach(function(wheel) {
  const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20);
  const wheelBody = new CANNON.Body({
    mass: 1,
    material: wheelMaterial
  });
  const q = new CANNON.Quaternion();
  q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
  wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
  wheelBodies.push(wheelBody);
  helper.addVisual(wheelBody, 'wheel');

});


//wheel model
var loader = new THREE.LegacyJSONLoader();
loader.load('https://raw.githubusercontent.com/baronwatts/models/master/jeep-wheel.js', function(geometry, materials) {
  wheelBodies.map((d, i) => {
    var model = new THREE.Mesh(geometry, materials);
    model.geometry.center();
    model.scale.set(1.5,1.5,1.5);
    model.castShadow = true;
    if(i == 1 || i == 3) model.rotateY(Math.PI);
    wheelBodies[i].threemesh.add(model);

  });
});

// Update wheels
world.addEventListener('postStep', function() {
  let index = 0;
  vehicle.wheelInfos.forEach(function(wheel) {
    vehicle.updateWheelTransform(index);
    const t = wheel.worldTransform;
    wheelBodies[index].threemesh.position.copy(t.position);
    wheelBodies[index].threemesh.quaternion.copy(t.quaternion);
    index++;
  });
});

//=========================================================================================== vehicle controls
var js = {
  forward: 0,
  turn: 0
};

function joystickCallback(forward, turn) {
  js.forward = forward;
  js.turn = -turn;
}

function updateDrive(forward = js.forward, turn = js.turn) {
  var maxSteerVal = 0.6;
  var maxForce = 15;
  var brakeForce = 5;
  var force = maxForce * forward;
  var steer = maxSteerVal * turn;


  //switch controls
  if (document.getElementById("myCar").checked == true) {

    followCam.parent = chassisBody.threemesh;
    var offset = new THREE.Vector3(vehicle.chassisBody.threemesh.position.x,vehicle.chassisBody.threemesh.position.y,vehicle.chassisBody.threemesh.position.z);
    camera.position.lerp(offset, 0.005);
    camera.lookAt(vehicle.chassisBody.threemesh.position);
    

    if (forward!=0){
      vehicle.setBrake(0, 0);
      vehicle.setBrake(0, 1);
      vehicle.setBrake(0, 2);
      vehicle.setBrake(0, 3);

      vehicle.applyEngineForce(force, 0);
      vehicle.applyEngineForce(force, 1);
    }else{
      vehicle.setBrake(brakeForce, 0);
      vehicle.setBrake(brakeForce, 1);
      vehicle.setBrake(brakeForce, 2);
      vehicle.setBrake(brakeForce, 3);
    }
    //Front 2 wheels
  vehicle.setSteeringValue(steer, 2);
  vehicle.setSteeringValue(steer, 3);
    
  } else {



    //character
    var maxSteerVal = 0.05;
    var maxForce = .5;
    var brakeForce = 10;
    var force = maxForce * forward;
    var steer = maxSteerVal * turn;


    if (forward!=0){
      mesh.translateZ(force);//move cube
      /*clip0.play();
      clip3.stop();*/
    }else{
      /*clip0.stop();
      clip3.play();*/
    }
    mesh.rotateY(steer);
    
  }



}//end updatedrive







//=========================================================================================== follow path
var percentage = 0;
var prevTime = Date.now();
function followPath() {
  //percentage += window.innerWidth < 1400 ? 0.00025 : 0.0005;
  percentage += 0.00035;
  var p4 = carPath.getPointAt((percentage - 0.0001) % 1)
  var p5 = carPath.getPointAt(percentage % 1);
  var p6 = carPath.getPointAt((percentage + 0.01) % 1);
  var p7 = carPath.getPointAt((percentage + 0.01 / 2) % 1);

  mesh.position.x = p5.x;
  mesh.position.z = p5.z;
  mesh.lookAt(p6.x, p6.y, p6.z);

}



//===================================================== raycast
var raycastHelperGeometry = new THREE.CylinderGeometry( 0, 1, 5, 1.5 );
raycastHelperGeometry.translate( 0, 0, 0 );
raycastHelperGeometry.rotateX( Math.PI / 2 );
raycastHelperMesh = new THREE.Mesh( raycastHelperGeometry, new THREE.MeshNormalMaterial() );
scene.add( raycastHelperMesh );

function checkCollision(){
  collidableMeshList.map((d,i)=>{
       var raycaster = new THREE.Raycaster(d.position, new THREE.Vector3(0, -1, 0));
        intersects = raycaster.intersectObject(collider);
        if ( intersects.length > 0 ) {
            raycastHelperMesh.position.set( 0, 0, 0 );
            raycastHelperMesh.lookAt( intersects[0].face.normal );
            raycastHelperMesh.position.copy( intersects[ 0 ].point );
        }
      d.position.y = intersects && intersects[0] ? intersects[0].point.y + .3 : 0;
    });
}

 
//===================================================== 3rd person view
var followCam = new THREE.Object3D();
followCam.position.copy(camera.position);
scene.add(followCam);
followCam.parent = mesh; 

var light = new THREE.DirectionalLight( new THREE.Color('white'), .25 );
light.position.set( 0, 2, 0 );  
light.castShadow = true; 
light.target = followCam;//shadow will follow mesh          
followCam.add( light );



var light = new THREE.DirectionalLight( new THREE.Color('gold'), .25 );
light.position.set( 0, 2, 0 );  
light.castShadow = true; 
light.target = dogemesh;//shadow will follow mesh          
scene.add( light );

//===================================================== update cam
function updateCamera(){
  camera.position.lerp(followCam.getWorldPosition(new THREE.Vector3()), 0.1);
  camera.lookAt(mesh.position.x,mesh.position.y,mesh.position.z);
  camera.position.z = camera.position.z + 1;
}


//===================================================== update doge
function updateDoge(){

   if (document.getElementById("myCheck").checked == true) {
    followCam.parent = dogemesh;
    camera.lookAt(dogemesh.position);
    var offset = new THREE.Vector3(checkpoint.position.x,dogemesh.position.y,checkpoint.position.z);
    dogemesh.position.lerp(offset, 0.005);
    dogemesh.lookAt(checkpoint.position.x,checkpoint.position.y,checkpoint.position.z);

   }else{
    followCam.parent = mesh;
    var offset = new THREE.Vector3(mesh.position.x,dogemesh.position.y,mesh.position.z);
    dogemesh.position.lerp(offset, 0.05);
    dogemesh.lookAt(mesh.position.x,mesh.position.y,mesh.position.z);
    
   }

  var offset = new THREE.Vector3(mesh.position.x,1,mesh.position.z);
  birdmesh.position.lerp(offset, 0.035);
  birdmesh.lookAt(mesh.position.x,mesh.position.y,mesh.position.z);
}



//===================================================== animate
var fixedTimeStep = 1.0 / 60.0;
var lastTime;
(function animate() {
  const delta = clock.getDelta();
  requestAnimationFrame(animate);
  renderer.render( scene, camera );
  

  // Update physics
  const now = Date.now();
  if (lastTime === undefined) lastTime = now;
  const dt = (Date.now() - lastTime) / 1000.0;
  world.step(fixedTimeStep, dt);
  helper.updateBodies(world);


  // Update three
  mixers.map(x=>x.update(delta));
  followPath();
 updateCamera();
 updateDoge();
 checkCollision();
 updateDrive();







})();