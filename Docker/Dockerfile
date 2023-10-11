FROM python:3.8

WORKDIR /root

RUN apt update && apt install -y git wget libgl1-mesa-glx

RUN pip install --upgrade pip

RUN git clone https://github.com/CENTRE-FOR-SMART-TRANSPORTATION/cst-pointcloud-annotation_web-2023.git

RUN cd cst-pointcloud-annotation_web-2023 && \
        wget https://github.com/naurril/SUSTechPOINTS/releases/download/0.1/deep_annotation_inference.h5 -P algos/models && \
        pip install -r requirement.txt && pip install tensorflow

ENTRYPOINT ["python3", "/root/cst-pointcloud-annotation_web-2023/main.py"]

EXPOSE 8081
