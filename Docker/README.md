### Docker

First install docker for your system. You should have docker desktop, and should be able to run 
```
docker -v
```

from the terminal

#### Build Image and Run it

If you already built it before, delete previous images and containers for the annotation tool using docker desktop.
```
cd Docker

docker build --no-cache --progress=plain -t cst-pointcloud-annotation_web-2023 .

docker run -it -d --name cst-annotation -p 8081:8081 -v ${DATA_PATH}:/root/cst-pointcloud-annotation_web-2023/data cst-pointcloud-annotation_web-2023

```

DATA_PATH should be the path to your data folder. 
When using git bash on Windows, you'll need an extra ```/``` at the start of your path. 
So ```//c/<path>``` instead of ```/c/<path>```