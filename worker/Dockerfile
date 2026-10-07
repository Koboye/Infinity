FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV DIMTS_HOST=0.0.0.0
EXPOSE 7860
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
