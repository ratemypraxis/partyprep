
let camera3D, scene, renderer, light, cube, cube2;
let myCanvas, myVideo;
let people = {};  //make it an associatvie array with each person labeled by network id
let p5lm;
let p5s = [];
let texts = [];
let hitTestableObjects = [];
let in_front_of_you;
let in_front_of_you_t;
let currentObject;
let myTimer;


let group_id = "samroom420";
let db;

function connectToFirebase() {
    var config = {
        apiKey: "AIzaSyAh3IO6Z8pGgBfqLarcK2Bn4gtfhAQU7jY",
        authDomain: "osc-test-1614782864428.firebaseapp.com",
        databaseURL: "https://osc-test-1614782864428-default-rtdb.firebaseio.com",
        projectId: "osc-test-1614782864428",
        storageBucket: "osc-test-1614782864428.appspot.com",
        messagingSenderId: "1012748275305",
        appId: "1:1012748275305:web:f449270d4a314b0a8e1cf8"    

    };

    firebase.initializeApp(config);
    console.log(firebase)



    db = firebase.database();

    var myRef = db.ref('group/' + group_id + '/notes/').orderByChild('time');
    myRef.on('child_added', (data) => {
        console.log('child_added', data.key, data.val());
        let key = data.key;
        let thing = data.val();
        createNewText(thing.content, thing.location, key, thing.camera, thing.cameraFOV)
    });

    myRef.on('child_changed', (data) => {
        console.log('child_changed', data.key, data.val());
        for (var i = 0; i < texts.length; i++) {
            let thing = data.val();
            if (texts[i].DBid == data.key) {
                texts[i].text = thing.content;
                texts[i].camera = thing.camera;
                texts[i].cameraFOV = thing.cameraFOV;
                texts[i].text.object.position.x = thing.location.x;
                texts[i].text.object.position.y = thing.location.y;
                texts[i].text.object.position.z = thing.location.z;
                paintText(texts[i].canvas, thing.content)
            }
        }
    });

    myRef.on('child_removed', (data) => {
        console.log('child_removed', data.key);
        for (var i = texts.length; i > -1; i--) {
            if (texts[i].DBid == data.key) {
                texts[i].splice(i, 1);
                break;
            }
        }
    });

    myRef.on('child_moved', (data) => {  // order changed
        console.log('child_moved', data);
        texts.sort(function (a, b) {
            return a.time > b.time;
        });
    });


}

function updateDB() {
    let content = { "text": this.text, "shape": this.shape, "color": this.bgcolor};
    let location = { "x": this.pos.x, "y": this.pos.y, "z": this.pos.z, "xrot": this.rot.x, "yrot": this.rot.y, "zrot": this.rot.z }

    let mydata = {
        'netid': myNetid,
        'member_id': member_id,
        'group_id': group_id,
        'grouping_id': grouping_id,
        'location': location,
        'content': content
    };

    if (this.DBid == -1) {
        let returnInfo = db.ref('group/' + group_id + '/notes/').push(mydata);
        this.DBid = returnInfo.key;
    } else {
        db.ref('group/' + group_id + '/notes/' + current_note.DBid).update(mydata);
    }
}


connectToFirebase();



function setup() {
    console.log("setup");
    myCanvas = createCanvas(512, 512);
    myCanvas.hide();
    //let captureConstraints =  allowCameraSelection(myCanvas.width,myCanvas.height) ;
    //myVideo = createCapture(captureConstraints, videoLoaded);
    //below is simpler if you don't need to select Camera because default is okay
    myVideo = createCapture(VIDEO, videoLoaded);
    myVideo.size(myCanvas.width, myCanvas.height);
    myVideo.elt.muted = true;
    myVideo.hide()

    
    init3D();

    //create the local thing
    creatNewVideoObject(myVideo, "me");
}


///move people around and tell them about 
function keyPressed() {
    let me = people["me"];
    if (keyCode == 37 || key == "a") {
        me.angleOnCircle -= .05;

    } else if (keyCode == 39 || key == "d") {
        me.angleOnCircle += .05;
    

    } else if (keyCode == 38 || key == "w") {

    } else if (keyCode == 40 || key == "s") {

    }

    console.log(key);
    if (key == "Control") {
        createP5Instance(particleSystemSketch); 
      
    }
  

    positionOnCircle(me.angleOnCircle, me.object); //change it locally 
    //send it to others
    let dataToSend = { "angleOnCircle": me.angleOnCircle };
    p5lm.send(JSON.stringify(dataToSend));

}

function videoLoaded(stream) {
    p5lm = new p5LiveMedia(this, "CAPTURE", stream, "samroom456")
    p5lm.on('stream', gotStream);
    p5lm.on('data', gotData);
    p5lm.on('disconnect', gotDisconnect);
}

function gotData(data, id) {
    // If it is JSON, parse it
    let d = JSON.parse(data);
    positionOnCircle(d.angleOnCircle, people[id].object);

}

function gotStream(videoObject, id) {
    //this gets called when there is someone else in the room, new or existing
    videoObject.hide();  //don't want the dom object, will use in p5 and three.js instead
    //get a network id from each person who joins
    creatNewVideoObject(videoObject, id);
}

function gotDisconnect(id) {
    people[id].videoObject.remove(); //dom version
    scene.remove(people[id].object); //three.js version
    delete people[id];  //remove from our variable
}

function creatNewVideoObject(videoObject, id) {  //this is for remote and local
    var videoGeometry = new THREE.PlaneGeometry(256, 256);
    let myTexture = new THREE.Texture(videoObject.elt);  //NOTICE THE .elt  this give the element
    let videoMaterial = new THREE.MeshBasicMaterial({ map: myTexture, side: THREE.DoubleSide });
    videoMaterial.map.minFilter = THREE.LinearFilter;  //otherwise lots of power of 2 errors
    myAvatarObj = new THREE.Mesh(videoGeometry, videoMaterial);

    scene.add(myAvatarObj);

    //they can move that around but we need to put you somewhere to start
    angleOnCircle = positionOnCircle(null, myAvatarObj);

    //remember a bunch of things about each connection in json but we are really only using texture in draw
    //use an named or associate array where each oject is labeled with an ID
    people[id] = { "object": myAvatarObj, "texture": myTexture, "id": id, "videoObject": videoObject, "angleOnCircle": angleOnCircle };

}

function positionOnCircle(angle, thisAvatar) {
    //position it on a circle around the middle
    if (angle == null) { //first time
        angle = random(2*Math.PI); 
    }
      //imagine a circle looking down on the world and do High School math
    let distanceFromCenter = 650;
    x = distanceFromCenter * Math.sin(angle);
    z = distanceFromCenter * Math.cos(angle);
    thisAvatar.position.set(x, 0, z);  //zero up and down
    thisAvatar.lookAt(0, 0, 0);  //oriented towards the camera in the center
    return angle;
}

function positionOnCube(angle, thisAvatar) {
    //position it on a circle around the middle
    if (angle == null) { //first time
        angle = random(2*Math.PI); 
    }
      //imagine a circle looking down on the world and do High School math
    let distanceFromCenter = 650;
    x = distanceFromCenter * Math.sin(angle);
    z = distanceFromCenter * Math.cos(angle);
    thisAvatar.position.set(x, 0, z);  //zero up and down
    thisAvatar.lookAt(0, 0, 0);  //oriented towards the camera in the center
    return angle;
}

function draw() {
    //go through all the people an update their texture, animate would be another place for this
    for(id in people){
        let thisPerson = people[id];
        if (thisPerson .videoObject.elt.readyState == thisPerson .videoObject.elt.HAVE_ENOUGH_DATA) {
            //check that the transmission arrived okay
            //then tell three that something has changed.
            thisPerson.texture.needsUpdate = true;
        }
    }
}


function init3D() {
    scene = new THREE.Scene();
    camera3D = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ alpha: true }); //make it so you can see dom elements behind    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    //document.body.appendChild(renderer.domElement);

    //this puts the three.js stuff in a particular div
    document.getElementById('container').appendChild(renderer.domElement);

    light = new THREE.PointLight(0xFF00);
    /* position the light so it shines on the cube (x, y, z) */
    light.position.set(0, 0, 0);
    scene.add(light);



    const geometry = new THREE.BoxGeometry(2, 1, 2, 2, 2, 2);
    const material = new THREE.MeshBasicMaterial({
        map: THREE.ImageUtils.loadTexture('disco.jpg')
     });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    const geometry2 = new THREE.BoxGeometry(2, 1, 2, 2, 2, 2);
    const material2 = new THREE.MeshBasicMaterial({
        map: THREE.ImageUtils.loadTexture('laser1.jpg')
     });
    cube2 = new THREE.Mesh(geometry2, material2);
    scene.add(cube2);

    let bgGeometery = new THREE.SphereGeometry(1000, 60, 40);
   // let bgGeometery = new THREE.CylinderGeometry(725, 725, 1000, 10, 10, true)
    bgGeometery.scale(-1, 1, 1);
    let panotexture = new THREE.TextureLoader().load("yardDimy.jpg");
    let backMaterial = new THREE.MeshBasicMaterial({ map: panotexture });

    let back = new THREE.Mesh(bgGeometery, backMaterial);
    scene.add(back);


    //tiny little dot (could be invisible) for placing things in front of you
    var geometryFront = new THREE.BoxGeometry(1, 1, 1);
    var materialFront = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    in_front_of_you = new THREE.Mesh(geometryFront, materialFront);
    camera3D.add(in_front_of_you); // then add in front of the camera so it follow it
    in_front_of_you.position.set(0, 0, 600);

    //tiny little dot (could be invisible) for placing things in front of you
    var geometryFront_t = new THREE.BoxGeometry(1, 1, 1);
    var materialFront_t = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    in_front_of_you_t = new THREE.Mesh(geometryFront_t, materialFront_t);
    camera3D.add(in_front_of_you_t); // then add in front of the camera so it follow it
    in_front_of_you_t.position.set(0, 0, 600);
    
    moveCameraWithMouse();


    camera3D.position.z = 0;
    animate();
}

function hitTest(x, y) {  //called from onDocumentMouseDown()
    var mouse = { "x": 0, "y": 0 };
    var raycaster = new THREE.Raycaster(); // create once
    //var mouse = new THREE.Vector2(); // create once
    mouse.x = (x / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = - (y / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera3D);
    var intersects = raycaster.intersectObjects(hitTestableOjects, false);
    // if there is one (or more) intersections
    currentObject = null;
    $("#text").val("");
    $("#text").css({ position: "absolute", left: x, top: y });
    if (intersects.length > 0) {
        let hitObjID = intersects[0].object.uuid; //closest object

        for (var i = 0; i < texts.length; i++) {
        
            if (texts[i].Threeid == hitObjID) {
                currentObject = texts[i];
                 //and put text in input box.
                $("#text").val(texts[i].text);
     
                //do some hiliting maybe later
                break;
            }
        }
    }
    console.log(currentObject);

}



function animate() {

  cube.scale.x = 1;
    cube.scale.y = 1;
    cube.scale.z = 1;
    cube.rotation.x += .01;
    cube.rotation.y += .01;
    cube.position.x = -8;
    cube.position.z = -8;

    cube2.scale.x = 1;
    cube2.scale.y = 1;
    cube2.scale.z = 1;
    cube2.rotation.x += .01;
    cube2.rotation.y += .01;
    cube2.rotation.z += .01;
    cube2.position.x = 12;
    cube2.position.z = 12;

    requestAnimationFrame(animate);
    for (var i = 0; i < p5s.length; i++){
        p5s[i].texture.needsUpdate = true;
    }
    for (var i = 0; i < texts.length; i++) {
        texts[i].texture.needsUpdate = true;
    }


    renderer.render(scene, camera3D);
}

var textInput = document.getElementById("text");  //get a hold of something in the DOM
textInput.addEventListener("mousedown", function (e) {
    e.stopImmediatePropagation();
    //don't let it go to the elements under the text box
});




textInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {  //checks whether the pressed key is "Enter"
        if (currentObject) { //hit test returned somethigng
            updateText(textInput.value, currentObject);
            console.log("update text");
        } else {
            createNewText(textInput.value); //don't ghave location and key as parameters when it is local
        }
    }
});

function paintText(canvas,text){
    var context = canvas.getContext("2d");
    context.fillStyle = "lightblue";
    context.fillRect(0,0,canvas.width, canvas.height);
    //context.clearRect(0, 0, canvas.width, canvas.height);  //this would allow you to use "transparent" in material parameters
    var fontSize = 72; // Math.max(camera3D.fov / 2, 72);
    context.font = fontSize + "pt times";
    context.textAlign = "center";
    context.fillStyle = "black";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
}


function createNewText(text_msg, location, key) {
    console.log("Created New Text");
    var canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    paintText(canvas, text_msg);  //do this is function so you can also do it to hilite hit test and update
    var textTexture = new THREE.Texture(canvas);
    textTexture.needsUpdate = true;
    var material = new THREE.MeshBasicMaterial({ map: textTexture, transparent: false });
    var geo = new THREE.PlaneGeometry(2, 1);
    var mesh = new THREE.Mesh(geo, material);
    let DBid = key; //will be null if it did not come in from databaase
    if (location) { //came in from database
        mesh.position.x = location.x;
        mesh.position.y = location.y;
        mesh.position.z = location.z;
    } else { //local and needs location and to be put in the database
        const posInWorld_t = new THREE.Vector3();
        //remember we attached a tiny to the  front of the camera in init, now we are asking for its position
        in_front_of_you_t.position.set(0, 0, -(600 - camera3D.fov * 7));  //base the the z position on camera field of view
        in_front_of_you_t.getWorldPosition(posInWorld_t);
        mesh.position.x = posInWorld_t.x;
        mesh.position.y = posInWorld_t.y;
        mesh.position.z = posInWorld_t.z;
        //add it to firebase database
        location = { "x": mesh.position.x, "y": mesh.position.y, "z": mesh.position.z, "xrot": mesh.rotation.x, "yrot": mesh.rotation.y, "zrot": mesh.rotation.z }
        let mydata = {
            'location': location,
            'content': text_msg,
        };
        //insert in the database
        let returnInfo = db.ref('group/' + group_id + '/notes/').push(mydata);
        //get the id that the database uses so you can update it later
        DBid = returnInfo.key;
        // console.log(posInWorld_t);
    }

    mesh.lookAt(0, 0, 0);

    mesh.scale.set(10, 10, 10);
    scene.add(mesh);
    //two id's one for Three and one for the database
    texts.push({ "object": mesh, "canvas": canvas, "location": location, "texture": textTexture, "text": text_msg, "Threeid": mesh.uuid, "DBid": DBid });
    hitTestableObjects.push(mesh);
}

function updateText(text, note) {
    note.text = text;
    paintText(note.canvas, text)
    let mydata = {
        'location': note.location,
        'content': note.text,
    };
    db.ref('group/' + group_id + '/notes/' + note.DBid).update(mydata);
}



function onDocumentKeyDown(e) {
    clearTimeout(myTimer);
    if (currentObject) {
        if (e.key == "ArrowRight") {
            console.log(e.key);
            currentObject.object.position.x = currentObject.object.position.x + 1;
        } else if (e.key == "ArrowLeft") {
            currentObject.object.position.x = currentObject.object.position.x - 1;
        } else if (e.key == "ArrowUp") {
            currentObject.object.position.y = currentObject.object.position.y - 1;
        } else if (e.key == "ArrowDown") {
            currentObject.object.position.y = currentObject.object.position.y + 1;
        }
        currentObject.location = { "x": currentObject.object.position.x, "y": currentObject.object.position.y, "z": currentObject.object.position.z, "xrot": currentObject.object.rotation.x, "yrot": currentObject.object.rotation.y, "zrot": currentObject.object.rotation.z }

        myTimer = setTimeout(function () {
            let mydata = {
                'location': currentObject.location,
                'content': currentObject.text
            };
            console.log("sending");
            db.ref('group/' + group_id + '/notes/' + currentObject.DBid).update(mydata);

        }, 3000);
    }
    //console.log(event.key);
    // if (event.key == " ") {
    //     
    // }
}

function createP5Instance(which) {
    let sketchInstance = new p5(which); //this name is in your sketch

    let geo = new THREE.PlaneGeometry(512, 512);
    let p5Texture = new THREE.Texture(sketchInstance.getP5Canvas()); // pull the canvas out of the p5 sketch
    let mat = new THREE.MeshBasicMaterial({ map: p5Texture, transparent: true, opacity: 1, side: THREE.DoubleSide });

    let plane = new THREE.Mesh(geo, mat);
    scene.add(plane);

    const posInWorld = new THREE.Vector3();
    //remember we attached a tiny to the  front of the camera in init, now we are asking for its position
    in_front_of_you.position.set(0, 0, -(700 - camera3D.fov * 5)); //base the the z position on camera field of view
    in_front_of_you.getWorldPosition(posInWorld);
    plane.position.x = posInWorld.x;
    plane.position.y = posInWorld.y;
    plane.position.z = posInWorld.z;
    console.log(posInWorld);
    plane.lookAt(0, 0, 0);
    p5s.push({ "object": plane, "texture": p5Texture, "p5SketchInstance": sketchInstance });

    console.log("textured a plane");
    //plane.scale.set(1, 1, 1);
}



    /////MOUSE STUFF  ///YOU MIGHT NOT HAVE TO LOOK DOWN BELOW HERE VERY MUCH
    var onMouseDownMouseX = 0, onMouseDownMouseY = 0;
    var onPointerDownPointerX = 0, onPointerDownPointerY = 0;
    var lon = -90, onMouseDownLon = 0; //start at -90 degrees for some reason
    var lat = 0, onMouseDownLat = 0;
    var isUserInteracting = false;
    
    function moveCameraWithMouse() {
        document.addEventListener('keydown', onDocumentKeyDown, false);
        document.addEventListener('mousedown', onDocumentMouseDown, false);
        document.addEventListener('mousemove', onDocumentMouseMove, false);
        document.addEventListener('mouseup', onDocumentMouseUp, false);
        document.addEventListener('wheel', onDocumentMouseWheel, false);
        window.addEventListener('resize', onWindowResize, false);
        camera3D.target = new THREE.Vector3(0, 0, 0); 
    }



    function onDocumentMouseDown(event) {
        onPointerDownPointerX = event.clientX;
        onPointerDownPointerY = event.clientY;
        onPointerDownLon = lon;
        onPointerDownLat = lat;
        isUserInteracting = true;
    }

    function onDocumentMouseMove(event) {
        if (isUserInteracting) {
            lon = (onPointerDownPointerX - event.clientX) * 0.1 + onPointerDownLon;
            lat = (event.clientY - onPointerDownPointerY) * 0.1 + onPointerDownLat;
            computeCameraOrientation();
        }
    }
    


    function onDocumentMouseUp(event) {
        isUserInteracting = false;
    }

    function onDocumentMouseWheel(event) {
        camera3D.fov += event.deltaY * 0.05;
        camera3D.updateProjectionMatrix();
    }

    function computeCameraOrientation() {
        lat = Math.max(-30, Math.min(30, lat)); //restrict movement
        let phi = THREE.Math.degToRad(90 - lat); //restrict movement
        let theta = THREE.Math.degToRad(lon);
        camera3D.target.x = 100 * Math.sin(phi) * Math.cos(theta);
        camera3D.target.y = 100 * Math.cos(phi);
        camera3D.target.z = 100 * Math.sin(phi) * Math.sin(theta);
        camera3D.lookAt(camera3D.target);
    }


    function onWindowResize() {
        camera3D.aspect = window.innerWidth / window.innerHeight;
        camera3D.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        console.log('Resized');
    }

    function allowCameraSelection(w, h) {
        //This whole thing is to build a pulldown menu for selecting between cameras
        //manual alternative to all of this pull down stuff:
        //type this in the console and unfold resulst to find the device id of your preferredwebcam, put in sourced id below
        //navigator.mediaDevices.enumerateDevices()
        //default settings
        let videoOptions = {
            audio: true, video: {
                width: w,
                height: h
            }
        };

        let preferredCam = localStorage.getItem('preferredCam');
        //if you changed it in the past and stored setting
        if (preferredCam) {
            videoOptions = {
                video: {
                    width: w,
                    height: h,
                    sourceId: preferredCam
                }
            };
        }
        //create a pulldown menu for picking source
        navigator.mediaDevices.enumerateDevices().then(function (d) {
            var sel = createSelect();
            sel.position(10, 10);
            for (var i = 0; i < d.length; i++) {
                if (d[i].kind == "videoinput") {
                    let label = d[i].label;
                    let ending = label.indexOf('(');
                    if (ending == -1)
                        ending = label.length;
                    label = label.substring(0, ending);
                    sel.option(label, d[i].deviceId);
                }
                if (preferredCam)
                    sel.selected(preferredCam);
            }
            sel.changed(function () {
                let item = sel.value();
                //console.log(item);
                localStorage.setItem('preferredCam', item);
                videoOptions = {
                    video: {
                        optional: [{
                            sourceId: item
                        }]
                    }
                };
                myVideo.remove();
                myVideo = createCapture(videoOptions, VIDEO);
                myVideo.hide();
                console.log("Preferred Camera", videoOptions);
            });
        });
        return videoOptions;
    }
