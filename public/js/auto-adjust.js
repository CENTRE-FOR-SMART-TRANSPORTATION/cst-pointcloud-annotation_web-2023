import {
  transpose,
  matmul2,
  euler_angle_to_rotate_matrix_3by3,
  normalizeAngle,
} from "./util.js";
import { logger } from "./log.js";

// todo: this module needs a proper name

function AutoAdjust(boxOp, mouse, header) {
  (this.boxOp = boxOp), (this.mouse = mouse);
  this.header = header;
  var marked_object = null;

  // mark bbox, which will be used as reference-bbox of an object.
  this.mark_bbox = function (box) {
    if (box) {
      this.marked_object = {
        frame: box.world.frameInfo.frame,
        scene: box.world.frameInfo.scene,
        ann: box.world.annotation.boxToAnn(box),
      };

      logger.log(`selected reference objcet ${this.marked_object}`);

      this.header.set_ref_obj(this.marked_object);
    }
  };

  this.followStaticObjects = function (box) {
    let world = box.world;
    let staticObjects = world.annotation.boxes
      .filter((b) => b != box && b.obj_attr && b.obj_attr.search("static") >= 0)
      .map((refObj) => {
        let coord = euler_angle_to_rotate_matrix_3by3(refObj.rotation);
        let trans = transpose(coord, 3);
        let p = [
          box.position.x - refObj.position.x,
          box.position.y - refObj.position.y,
          box.position.z - refObj.position.z,
        ];
        let relativePos = matmul2(trans, p, 3);
        let relativeRot = {
          x: normalizeAngle(box.rotation.x - refObj.rotation.x),
          y: normalizeAngle(box.rotation.y - refObj.rotation.y),
          z: normalizeAngle(box.rotation.z - refObj.rotation.z),
        };

        let distance = Math.sqrt(
          relativePos[0] * relativePos[0] +
            relativePos[1] * relativePos[1] +
            relativePos[2] * relativePos[2]
        );
        return {
          obj_track_id: refObj.obj_track_id,
          relativePos,
          relativeRot,
          distance,
        };
      });

    let worldList = box.world.data.worldList;
    //let saveList = [];
    worldList.forEach((w) => {
      if (w === box.world) {
        //current frame
        return;
      }

      let existedBox = w.annotation.boxes.find(
        (b) => b.obj_track_id == box.obj_track_id
      );
      if (existedBox && !existedBox.annotator) {
        // have same objects annotated.
        // if its generated by machine, lets overwrite it
        return;
      }

      let candPoseSets = staticObjects.map((refObj) => {
        let refObjInW = w.annotation.boxes.find(
          (b) => b.obj_track_id == refObj.obj_track_id
        );
        if (!refObjInW) {
          // not found refobj in this world, give up
          return null;
        }

        let relativePos = refObj.relativePos;
        let relativeRot = refObj.relativeRot;

        let coord = euler_angle_to_rotate_matrix_3by3(refObjInW.rotation);

        let rp = matmul2(coord, relativePos, 3);
        let newObjPos = {
          x: refObjInW.position.x + rp[0],
          y: refObjInW.position.y + rp[1],
          z: refObjInW.position.z + rp[2],
        };

        let newObjRot = {
          x: normalizeAngle(refObjInW.rotation.x + relativeRot.x),
          y: normalizeAngle(refObjInW.rotation.y + relativeRot.y),
          z: normalizeAngle(refObjInW.rotation.z + relativeRot.z),
        };

        return {
          distance: refObj.distance,
          weight: Math.exp(-refObj.distance * (refObjInW.annotator ? 1 : 0.1)),
          position: newObjPos,
          rotation: newObjRot,
        };
      });

      candPoseSets = candPoseSets.filter((p) => !!p);

      if (candPoseSets.length == 0) {
        return;
      }

      // calculate mean pos/rot
      let denorm = candPoseSets.reduce((a, b) => a + b.weight, 0);

      let newObjPos = { x: 0, y: 0, z: 0 };
      let newObjRot = { x: 0, y: 0, z: 0, cosZ: 0, sinZ: 0 };
      candPoseSets.forEach((p) => {
        newObjPos.x += p.position.x * p.weight;
        newObjPos.y += p.position.y * p.weight;
        newObjPos.z += p.position.z * p.weight;

        newObjRot.x += p.rotation.x * p.weight;
        newObjRot.y += p.rotation.y * p.weight;
        //newObjRot.z += p.rotation.z * p.weight;
        newObjRot.cosZ += Math.cos(p.rotation.z) * p.weight;
        newObjRot.sinZ += Math.sin(p.rotation.z) * p.weight;
      });

      newObjPos.x /= denorm;
      newObjPos.y /= denorm;
      newObjPos.z /= denorm;
      newObjRot.x /= denorm;
      newObjRot.y /= denorm;
      newObjRot.cosZ /= denorm;
      newObjRot.sinZ /= denorm;
      newObjRot.z = Math.atan2(newObjRot.sinZ, newObjRot.cosZ);

      // ignor distant objects

      if (pointsGlobalConfig.ignoreDistantObject) {
        let objDistance = Math.sqrt(
          newObjPos.x * newObjPos.x +
            newObjPos.y * newObjPos.y +
            newObjPos.z * newObjPos.z
        );

        if ((box.scale.z < 2 && objDistance > 100) || objDistance > 150) {
          return;
        }
      }

      // apply
      if (existedBox) {
        existedBox.position.x = newObjPos.x;
        existedBox.position.y = newObjPos.y;
        existedBox.position.z = newObjPos.z;

        existedBox.rotation.x = newObjRot.x;
        existedBox.rotation.y = newObjRot.y;
        existedBox.rotation.z = newObjRot.z;

        existedBox.scale.x = box.scale.x;
        existedBox.scale.y = box.scale.y;
        existedBox.scale.z = box.scale.z;

        existedBox.annotator = "S";

        logger.log(`modified box in ${w}`);
      } else {
        let newBox = w.annotation.add_box(
          newObjPos,
          box.scale,
          newObjRot,
          box.obj_type,
          box.obj_track_id,
          box.obj_attr
        );
        newBox.annotator = "S";

        w.annotation.load_box(newBox);
        logger.log(`inserted box in ${w}`);
      }

      console.log("added box in ", w.frameInfo.frame);
      //saveList.push(w);
      w.annotation.setModified();
    });
  };

  this.followsRef = function (box) {
    //find ref object in current frame
    let world = box.world;
    let refObj = world.annotation.boxes.find(
      (b) => b.obj_track_id == this.marked_object.ann.obj_id
    );
    if (refObj) {
      console.log("found ref obj in current frame");
      world.annotation.setModified();

      //compute relative position
      // represent obj in coordinate system of refobj

      let coord = euler_angle_to_rotate_matrix_3by3(refObj.rotation);
      let trans = transpose(coord, 3);
      let p = [
        box.position.x - refObj.position.x,
        box.position.y - refObj.position.y,
        box.position.z - refObj.position.z,
      ];
      const relativePos = matmul2(trans, p, 3);
      const relativeRot = {
        x: box.rotation.x - refObj.rotation.x,
        y: box.rotation.y - refObj.rotation.y,
        z: box.rotation.z - refObj.rotation.z,
      };

      let worldList = box.world.data.worldList;
      //let saveList = [];
      worldList.forEach((w) => {
        if (w === box.world) {
          //current frame
          return;
        }

        let existedBox = w.annotation.boxes.find(
          (b) => b.obj_track_id == box.obj_track_id
        );

        if (existedBox && !existedBox.annotator) {
          // have same objects annotated.
          // if its generated by machine, lets overwrite it
          return;
        }

        let refObjInW = w.annotation.boxes.find(
          (b) => b.obj_track_id == refObj.obj_track_id
        );
        if (!refObjInW) {
          // not found refobj in this world, give up
          return;
        }

        let coord = euler_angle_to_rotate_matrix_3by3(refObjInW.rotation);

        let rp = matmul2(coord, relativePos, 3);
        let newObjPos = {
          x: refObjInW.position.x + rp[0],
          y: refObjInW.position.y + rp[1],
          z: refObjInW.position.z + rp[2],
        };

        let newObjRot = {
          x: refObjInW.rotation.x + relativeRot.x,
          y: refObjInW.rotation.y + relativeRot.y,
          z: refObjInW.rotation.z + relativeRot.z,
        };

        if (existedBox) {
          existedBox.position.x = newObjPos.x;
          existedBox.position.y = newObjPos.y;
          existedBox.position.z = newObjPos.z;

          existedBox.rotation.x = newObjRot.x;
          existedBox.rotation.y = newObjRot.y;
          existedBox.rotation.z = newObjRot.z;

          existedBox.scale.x = box.scale.x;
          existedBox.scale.y = box.scale.y;
          existedBox.scale.z = box.scale.z;

          existedBox.annotator = "F";
          existedBox.follows = {
            obj_track_id: refObj.obj_track_id,
            relative_position: {
              x: relativePos[0],
              y: relativePos[1],
              z: relativePos[2],
            },
            relative_rotation: relativeRot,
          };

          logger.log(`modified box in ${w}`);
        } else {
          let newBox = w.annotation.add_box(
            newObjPos,
            box.scale,
            newObjRot,
            box.obj_type,
            box.obj_track_id,
            box.obj_attr
          );
          newBox.annotator = "F";
          newBox.follows = {
            obj_track_id: refObj.obj_track_id,
            relative_position: {
              x: relativePos[0],
              y: relativePos[1],
              z: relativePos[2],
            },
            relative_rotation: relativeRot,
          };

          w.annotation.load_box(newBox);
          logger.log(`inserted box in ${w}`);
        }

        console.log("added box in ", w.frameInfo.frame);
        //saveList.push(w);
        w.annotation.setModified();
      });

      //saveWorldList(saveList);
    }
  };

  this.syncFollowers = function (box) {
    let world = box.world;
    let allFollowers = world.annotation.boxes.filter(
      (b) => b.follows && b.follows.obj_track_id === box.obj_track_id
    );

    if (allFollowers.length == 0) {
      console.log("no followers");
      return;
    }

    let refObj = box;
    let coord = euler_angle_to_rotate_matrix_3by3(refObj.rotation);

    allFollowers.forEach((fb) => {
      let relpos = [
        fb.follows.relative_position.x,
        fb.follows.relative_position.y,
        fb.follows.relative_position.z,
      ];

      let rp = matmul2(coord, relpos, 3);

      fb.position.x = refObj.position.x + rp[0];
      fb.position.y = refObj.position.y + rp[1];
      fb.position.z = refObj.position.z + rp[2];

      fb.rotation.x = refObj.rotation.x + fb.follows.relative_rotation.x;
      fb.rotation.y = refObj.rotation.y + fb.follows.relative_rotation.y;
      fb.rotation.z = refObj.rotation.z + fb.follows.relative_rotation.z;
    });
  };

  this.paste_bbox = function (pos, add_box) {
    if (!pos) pos = this.marked_object.ann.psr.position;
    else pos.z = this.marked_object.ann.psr.position.z;

    return add_box(
      pos,
      this.marked_object.ann.psr.scale,
      this.marked_object.ann.psr.rotation,
      this.marked_object.ann.obj_type,
      this.marked_object.ann.obj_id,
      this.marked_object.ann.obj_attr
    );
  };

  // this.auto_adjust_bbox=function(box, done, on_box_changed){

  //     saveWorld(function(){
  //         do_adjust(box, on_box_changed);
  //     });
  //     let _self =this;
  //     function do_adjust(box, on_box_changed){
  //         console.log("auto adjust highlighted bbox");

  //         var xhr = new XMLHttpRequest();
  //         // we defined the xhr

  //         xhr.onreadystatechange = function () {
  //             if (this.readyState != 4) return;

  //             if (this.status == 200) {
  //                 console.log(this.responseText)
  //                 console.log(box.position);
  //                 console.log(box.rotation);

  //                 var trans_mat = JSON.parse(this.responseText);

  //                 var rotation = Math.atan2(trans_mat[4], trans_mat[0]) + box.rotation.z;
  //                 var transform = {
  //                     x: -trans_mat[3],
  //                     y: -trans_mat[7],
  //                     z: -trans_mat[11],
  //                 }

  //                 /*
  //                 cos  sin    x
  //                 -sin cos    y
  //                 */
  //                 var new_pos = {
  //                     x: Math.cos(-rotation) * transform.x + Math.sin(-rotation) * transform.y,
  //                     y: -Math.sin(-rotation) * transform.x + Math.cos(-rotation) * transform.y,
  //                     z: transform.z,
  //                 };

  //                 box.position.x += new_pos.x;
  //                 box.position.y += new_pos.y;
  //                 box.position.z += new_pos.z;

  //                 box.scale.x = marked_object.scale.x;
  //                 box.scale.y = marked_object.scale.y;
  //                 box.scale.z = marked_object.scale.z;

  //                 box.rotation.z -= Math.atan2(trans_mat[4], trans_mat[0]);

  //                 console.log(box.position);
  //                 console.log(box.rotation);

  //                 on_box_changed(box);

  //                 _self.header.mark_changed_flag();

  //                 if (done){
  //                     done();
  //                 }
  //             }

  //             // end of state change: it can be after some time (async)
  //         };

  //         xhr.open('GET',
  //                 "/auto_adjust"+"?scene="+marked_object.scene + "&"+
  //                             "ref_frame=" + marked_object.frame + "&" +
  //                             "object_id=" + marked_object.obj_track_id + "&" +
  //                             "adj_frame=" + data.world.frameInfo.frame,
  //                 true);
  //         xhr.send();
  //     }
  // };

  this.smart_paste = function (selected_box, add_box, on_box_changed) {
    var box = selected_box;
    if (!box) {
      let sceneP = this.mouse.get_mouse_location_in_world();
      // trans pos to world local pos
      //let pos = this.data.world.scenePosToLidar(sceneP);
      box = this.paste_bbox(pos, add_box);
    } else if (this.marked_object) {
      box.scale.x = this.marked_object.ann.psr.scale.x;
      box.scale.y = this.marked_object.ann.psr.scale.y;
      box.scale.z = this.marked_object.ann.psr.scale.z;
    }

    // this.auto_adjust_bbox(box,
    //         function(){saveWorld();},
    //         on_box_changed);

    // this.header.mark_changed_flag();

    this.boxOp.auto_rotate_xyz(box, null, null, on_box_changed, "noscaling");
  };
}

export { AutoAdjust };
