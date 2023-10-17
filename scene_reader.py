
import os
import json
import prepare_pcd
import utm
import numpy as np
import shutil
import glob
import datetime
import json

this_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.join(this_dir, "data")

def cleanup_structure():
    ds_store = glob.glob(os.path.join(root_dir, "**/.DS_Store"), recursive=True)

    for f in ds_store:
        if os.path.exists(f):
            os.remove(f)
    
    unused_folder = os.path.join(root_dir, "unused")
    if not os.path.exists(unused_folder):
        os.makedirs(unused_folder)

    subfolders = os.listdir(root_dir)
    
    for folder in subfolders:
        if folder == "unused":
            continue
        folder_path = os.path.join(root_dir, folder)
        lidar_dir = os.path.join(folder_path, "lidar")
        las_dir = os.path.join(folder_path, "las_files")
        label_dir = os.path.join(folder_path, "label")

        if not os.path.exists(lidar_dir) and not os.path.exists(las_dir):
            suffix = datetime.datetime.now().strftime("%y%m%d_%H%M%S")
            shutil.move(folder_path, os.path.join(unused_folder, f'{folder}_{suffix}'))
            continue
        
        if len(os.listdir(lidar_dir)) == 0:
            suffix = datetime.datetime.now().strftime("%y%m%d_%H%M%S")
            shutil.move(folder_path, os.path.join(unused_folder, f'{folder}_{suffix}'))
            continue
        
        if not os.path.exists(label_dir):
            os.makedirs(label_dir)
        
        for f in os.listdir(lidar_dir):
            cut_name, _ = os.path.splitext(f)
            json_name = os.path.join(label_dir, f'{cut_name}.json')

            if not os.path.exists(json_name):
                with open(json_name,'w') as f:
                    json.dump([], f)

    return

def get_all_scenes():
    all_scenes = get_scene_names()
    print(all_scenes)
    return list(map(get_one_scene, all_scenes))


def get_all_scene_desc():
    names = get_scene_names()
    descs = {}
    for n in names:
        descs[n] = get_scene_desc(n)
    return descs


def get_scene_names():
    scenes = os.listdir(root_dir)
    scenes = filter(lambda s: not os.path.exists(
        os.path.join(root_dir, s, "disable") and s != "unused"), scenes)
    scenes = list(scenes)
    scenes.sort()
    return scenes


def get_scene_desc(s):
    scene_dir = os.path.join(root_dir, s)
    if os.path.exists(os.path.join(scene_dir, "desc.json")):
        with open(os.path.join(scene_dir, "desc.json")) as f:
            desc = json.load(f)
            return desc
    return None


def get_one_scene(s):
    scene = {
        "scene": s,
        "frames": []
    }

    scene_dir = os.path.join(root_dir, s)
    frames = os.listdir(os.path.join(scene_dir, "lidar"))
    las_files = None
    try:
        las_files = os.listdir(os.path.join(scene_dir, "las_files"))
    except FileNotFoundError:
        print("no las files")

    if las_files:
        for file in las_files:
            filename_cut, ext = os.path.splitext(os.path.basename(file))
            if ext != '.las':
                continue

            file_path = os.path.join(scene_dir, "las_files", file)
            pcd_name = os.path.join(
                scene_dir, "lidar", f'{filename_cut}_converted.pcd')

            if not os.path.isfile(pcd_name):
                global_centre = prepare_pcd.convert_for_server(file_path)
                json_name = os.path.join(
                    scene_dir, "label", f'{filename_cut}_converted.json')
                folder_name = os.path.join(scene_dir, "centres")
                if not os.path.exists(folder_name):
                    os.makedirs(folder_name)
                file_name = os.path.join(
                    folder_name, f'{filename_cut}_converted_centre.json')
                with open(json_name, 'w') as f:
                    json.dump([], f)
                print(file_name)
                with open(file_name, 'w') as f:
                    json.dump(global_centre, f)

    frames = os.listdir(os.path.join(scene_dir, "lidar"))
    frames.sort()

    print(frames)

    scene["lidar_ext"] = "pcd"
    for f in frames:
        # if os.path.isfile("./data/"+s+"/lidar/"+f):
        filename, fileext = os.path.splitext(f)
        scene["frames"].append(filename)
        scene["lidar_ext"] = fileext

    # point_transform_matrix=[]

    # if os.path.isfile(os.path.join(scene_dir, "point_transform.txt")):
    #     with open(os.path.join(scene_dir, "point_transform.txt"))  as f:
    #         point_transform_matrix=f.read()
    #         point_transform_matrix = point_transform_matrix.split(",")

    if os.path.exists(os.path.join(scene_dir, "desc.json")):
        with open(os.path.join(scene_dir, "desc.json")) as f:
            desc = json.load(f)
            scene["desc"] = desc

    calib = {}
    calib_camera = {}
    calib_radar = {}
    calib_aux_lidar = {}
    if os.path.exists(os.path.join(scene_dir, "calib")):
        if os.path.exists(os.path.join(scene_dir, "calib", "camera")):
            calibs = os.listdir(os.path.join(scene_dir, "calib", "camera"))
            for c in calibs:
                calib_file = os.path.join(scene_dir, "calib", "camera", c)
                calib_name, ext = os.path.splitext(c)
                if os.path.isfile(calib_file) and ext == ".json":
                    # print(calib_file)
                    with open(calib_file) as f:
                        cal = json.load(f)
                        calib_camera[calib_name] = cal

        if os.path.exists(os.path.join(scene_dir, "calib", "radar")):
            calibs = os.listdir(os.path.join(scene_dir, "calib", "radar"))
            for c in calibs:
                calib_file = os.path.join(scene_dir, "calib", "radar", c)
                calib_name, _ = os.path.splitext(c)
                if os.path.isfile(calib_file):
                    # print(calib_file)
                    with open(calib_file) as f:
                        cal = json.load(f)
                        calib_radar[calib_name] = cal
        if os.path.exists(os.path.join(scene_dir, "calib", "aux_lidar")):
            calibs = os.listdir(os.path.join(scene_dir, "calib", "aux_lidar"))
            for c in calibs:
                calib_file = os.path.join(scene_dir, "calib", "aux_lidar", c)
                calib_name, _ = os.path.splitext(c)
                if os.path.isfile(calib_file):
                    # print(calib_file)
                    with open(calib_file) as f:
                        cal = json.load(f)
                        calib_aux_lidar[calib_name] = cal

    # camera names
    camera = []
    camera_ext = ""
    cam_path = os.path.join(scene_dir, "camera")
    if os.path.exists(cam_path):
        cams = os.listdir(cam_path)
        for c in cams:
            cam_file = os.path.join(scene_dir, "camera", c)
            if os.path.isdir(cam_file):
                camera.append(c)

                if camera_ext == "":
                    # detect camera file ext
                    files = os.listdir(cam_file)
                    if len(files) >= 2:
                        _, camera_ext = os.path.splitext(files[0])

    if camera_ext == "":
        camera_ext = ".jpg"
    scene["camera_ext"] = camera_ext

    # radar names
    radar = []
    radar_ext = ""
    radar_path = os.path.join(scene_dir, "radar")
    if os.path.exists(radar_path):
        radars = os.listdir(radar_path)
        for r in radars:
            radar_file = os.path.join(scene_dir, "radar", r)
            if os.path.isdir(radar_file):
                radar.append(r)
                if radar_ext == "":
                    # detect camera file ext
                    files = os.listdir(radar_file)
                    if len(files) >= 2:
                        _, radar_ext = os.path.splitext(files[0])

    if radar_ext == "":
        radar_ext = ".pcd"
    scene["radar_ext"] = radar_ext

    # aux lidar names
    aux_lidar = []
    aux_lidar_ext = ""
    aux_lidar_path = os.path.join(scene_dir, "aux_lidar")
    if os.path.exists(aux_lidar_path):
        lidars = os.listdir(aux_lidar_path)
        for r in lidars:
            lidar_file = os.path.join(scene_dir, "aux_lidar", r)
            if os.path.isdir(lidar_file):
                aux_lidar.append(r)
                if radar_ext == "":
                    # detect camera file ext
                    files = os.listdir(radar_file)
                    if len(files) >= 2:
                        _, aux_lidar_ext = os.path.splitext(files[0])

    if aux_lidar_ext == "":
        aux_lidar_ext = ".pcd"
    scene["aux_lidar_ext"] = aux_lidar_ext

    # # ego_pose
    # ego_pose= {}
    # ego_pose_path = os.path.join(scene_dir, "ego_pose")
    # if os.path.exists(ego_pose_path):
    #     poses = os.listdir(ego_pose_path)
    #     for p in poses:
    #         p_file = os.path.join(ego_pose_path, p)
    #         with open(p_file)  as f:
    #                 pose = json.load(f)
    #                 ego_pose[os.path.splitext(p)[0]] = pose

    if True:  # not os.path.isdir(os.path.join(scene_dir, "bbox.xyz")):
        scene["boxtype"] = "psr"
        # if point_transform_matrix:
        #     scene["point_transform_matrix"] = point_transform_matrix
        if camera:
            scene["camera"] = camera
        if radar:
            scene["radar"] = radar
        if aux_lidar:
            scene["aux_lidar"] = aux_lidar
        if calib_camera:
            calib["camera"] = calib_camera
        if calib_radar:
            calib["radar"] = calib_radar
        if calib_aux_lidar:
            calib["aux_lidar"] = calib_aux_lidar
        # if ego_pose:
        #     scene["ego_pose"] = ego_pose

    # else:
    #     scene["boxtype"] = "xyz"
    #     if point_transform_matrix:
    #         scene["point_transform_matrix"] = point_transform_matrix
    #     if camera:
    #         scene["camera"] = camera
    #     if radar:
    #         scene["radar"] = radar
    #     if calib_camera:
    #         calib["camera"] = calib_camera
    #     if calib_radar:
    #         calib["radar"] = calib_radar
    #     if calib_aux_lidar:
    #         calib["aux_lidar"] = calib_aux_lidar

    scene["calib"] = calib

    return scene


def get_scene_centre(scene, frame):
    centre_filename = os.path.join(
        root_dir, scene, 'centres', f'{frame}_centre.json')
    
    centre = None
    if not os.path.exists(centre_filename):
        return {
            "centre": centre
        }

    with open(centre_filename, 'r') as f:
        centre = json.load(f)

    # can change it later to get from front end, in case location isn't correct
    utm_zone = 12

    lat, lon = utm.to_latlon(centre[0], centre[1], utm_zone, 'U')

    # Central meridian of our given UTM zone in longitude
    central_meridian = (6*utm_zone - 183)

    # Angle of local UTM 'north' relative to true North
    convergence_angle = (lon-central_meridian)*np.sin(lat) 
    
    # To get the heading relative to true north:
    # Obtain the angle of the forward vector relative to our Cartesian coordinate system (in UTM)
    # Translate it by -90 degrees to convert our forward vector angle from CCW East to CCW North
    # Then add it with our convergence angle to make it relative to true North, which Google Maps uses.
    # Then apply a negative sign for correcting the direction.

    # since we don't want to calculate trajectory here, I'll just put a temporaty forward vector
    forward_vecs = [1, 1]
    heading = -( ((np.arctan2(forward_vecs[1], forward_vecs[0])*(180/np.pi)) - 90) + convergence_angle)
    
    # open up the heading and latlon from google maps street view
    # just some settings for visualization
    pitch = 0
    fov = 120
    
    link=f"https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat}%2C{lon}&heading={heading}&pitch={pitch}&fov={fov}"

    return {
        "centre": centre,
        "link" : link,
    }


def read_annotations(scene, frame):
    filename = os.path.join(root_dir, scene, "label", frame+".json")
    if (os.path.isfile(filename)):
        with open(filename, "r") as f:
            ann = json.load(f)
            # print(ann)
            return ann
    else:
        return {}


def read_rural_labels():
    filename = os.path.join(this_dir, "rural_labels.json")
    if (os.path.isfile(filename)):
        with open(filename, "r") as f:
            labels = json.load(f)
            return labels
    else:
        return []


def read_urban_labels():
    filename = os.path.join(this_dir, "urban_labels.json")
    if (os.path.isfile(filename)):
        with open(filename, "r") as f:
            labels = json.load(f)
            return labels
    else:
        return []


def save_rural_label(label):
    filename = os.path.join(this_dir, "rural_labels.json")
    curLabels = dict()
    if (os.path.isfile(filename)):
        with open(filename, "r") as f:
            curLabels = json.load(f)

    print(curLabels)
    print(type(curLabels))
    for k in label:
        curLabels[k] = label[k]

    with open(filename, 'w') as outfile:
        json.dump(curLabels, outfile)

    return label


def save_urban_label(label):
    filename = os.path.join(this_dir, "urban_labels.json")
    curLabels = dict()
    if (os.path.isfile(filename)):
        with open(filename, "r") as f:
            curLabels = json.load(f)

    print(curLabels)
    print(type(curLabels))
    for k in label:
        curLabels[k] = label[k]

    with open(filename, 'w') as outfile:
        json.dump(curLabels, outfile)

    return label


def read_ego_pose(scene, frame):
    filename = os.path.join(root_dir, scene, "ego_pose", frame+".json")
    if (os.path.isfile(filename)):
        with open(filename, "r") as f:
            p = json.load(f)
            return p
    else:
        return None


def save_annotations(scene, frame, anno):
    filename = os.path.join(root_dir, scene, "label", frame+".json")
    with open(filename, 'w') as outfile:
        json.dump(anno, outfile)


if __name__ == "__main__":
    print(get_all_scenes())
