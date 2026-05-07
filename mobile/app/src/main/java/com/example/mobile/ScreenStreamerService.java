package com.example.mobile;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioPlaybackCaptureConfiguration;
import android.media.AudioRecord;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.ByteBuffer;

public class ScreenStreamerService extends Service {
    private static final String CHANNEL_ID = "ScreenStreamerChannel";
    private static final int PORT = 8080;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private MediaCodec videoCodec;
    private AudioRecord audioRecord;
    
    private ServerSocket serverSocket;
    private boolean isStreaming = false;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Screen Streamer")
                .setContentText("Streaming screen and audio...")
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .build();
        startForeground(1, notification);

        if (intent != null) {
            int resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED);
            Intent data = intent.getParcelableExtra("data");

            if (resultCode == Activity.RESULT_OK && data != null) {
                MediaProjectionManager projectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                if (projectionManager != null) {
                    mediaProjection = projectionManager.getMediaProjection(resultCode, data);
                    startServer();
                }
            }
        }
        return START_STICKY;
    }

    private void startServer() {
        isStreaming = true;
        new Thread(() -> {
            try {
                serverSocket = new ServerSocket(PORT);
                while (isStreaming) {
                    Socket clientSocket = serverSocket.accept();
                    handleClient(clientSocket);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void handleClient(Socket socket) {
        try {
            OutputStream out = socket.getOutputStream();
            setupVideoCodec(out);
            setupAudioCapture(out);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void setupVideoCodec(OutputStream out) throws Exception {
        WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        DisplayMetrics metrics = new DisplayMetrics();
        wm.getDefaultDisplay().getMetrics(metrics);
        int width = metrics.widthPixels;
        int height = metrics.heightPixels;
        int density = metrics.densityDpi;

        MediaFormat format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height);
        format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);
        format.setInteger(MediaFormat.KEY_BIT_RATE, 6000000);
        format.setInteger(MediaFormat.KEY_FRAME_RATE, 30);
        format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1);

        videoCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
        videoCodec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        
        virtualDisplay = mediaProjection.createVirtualDisplay("ScreenStreamer",
                width, height, density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                videoCodec.createInputSurface(), null, null);

        videoCodec.start();

        new Thread(() -> {
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            try {
                while (isStreaming) {
                    int outputBufferId = videoCodec.dequeueOutputBuffer(bufferInfo, 10000);
                    if (outputBufferId >= 0) {
                        ByteBuffer outputBuffer = videoCodec.getOutputBuffer(outputBufferId);
                        if (outputBuffer != null) {
                            byte[] outData = new byte[bufferInfo.size];
                            outputBuffer.get(outData);
                            // Writing raw H.264 frames to the socket
                            out.write(outData);
                        }
                        videoCodec.releaseOutputBuffer(outputBufferId, false);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void setupAudioCapture(OutputStream out) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                AudioPlaybackCaptureConfiguration config = new AudioPlaybackCaptureConfiguration.Builder(mediaProjection)
                        .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                        .addMatchingUsage(AudioAttributes.USAGE_GAME)
                        .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                        .build();

                AudioFormat audioFormat = new AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(44100)
                        .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                        .build();

                int bufferSize = AudioRecord.getMinBufferSize(44100, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);

                audioRecord = new AudioRecord.Builder()
                        .setAudioFormat(audioFormat)
                        .setBufferSizeInBytes(bufferSize)
                        .setAudioPlaybackCaptureConfig(config)
                        .build();

                audioRecord.startRecording();

                new Thread(() -> {
                    byte[] audioBuffer = new byte[bufferSize];
                    try {
                        while (isStreaming) {
                            int read = audioRecord.read(audioBuffer, 0, audioBuffer.length);
                            if (read > 0) {
                                // Muxing audio over the same socket requires a protocol. 
                                // For basic implementation we can just output it, but to prevent
                                // corrupting the H264 stream, it's commented out. You would typically 
                                // wrap frames with headers (e.g., [TYPE=VIDEO][SIZE][DATA]).
                                // out.write(audioBuffer, 0, read);
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }).start();
            } catch (SecurityException e) {
                e.printStackTrace();
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Screen Streamer", NotificationManager.IMPORTANCE_DEFAULT);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        isStreaming = false;
        if (virtualDisplay != null) virtualDisplay.release();
        if (videoCodec != null) {
            videoCodec.stop();
            videoCodec.release();
        }
        if (audioRecord != null) {
            audioRecord.stop();
            audioRecord.release();
        }
        if (mediaProjection != null) mediaProjection.stop();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }
}
