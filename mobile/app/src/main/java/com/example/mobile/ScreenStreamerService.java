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
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.util.concurrent.CopyOnWriteArrayList;

public class ScreenStreamerService extends Service {
    private static final String CHANNEL_ID = "ScreenStreamerChannel";
    private static final int PORT = 8080;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private MediaCodec videoCodec;
    
    private ServerSocket serverSocket;
    private boolean isStreaming = false;

    private byte[] spsPpsCache = null;
    private CopyOnWriteArrayList<OutputStream> clients = new CopyOnWriteArrayList<>();

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Screen Streamer")
                .setContentText("Streaming screen...")
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(1, notification);
        }

        if (intent != null) {
            int resultCode = intent.getIntExtra("resultCode", Activity.RESULT_CANCELED);
            Intent data = intent.getParcelableExtra("data");

            if (resultCode == Activity.RESULT_OK && data != null) {
                MediaProjectionManager projectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
                if (projectionManager != null) {
                    mediaProjection = projectionManager.getMediaProjection(resultCode, data);
                    try {
                        setupVideoCodec();
                        startServer();
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }
        return START_STICKY;
    }

    private void setupVideoCodec() throws Exception {
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
        
        format.setInteger(MediaFormat.KEY_PROFILE, MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline);
        format.setInteger(MediaFormat.KEY_LEVEL, MediaCodecInfo.CodecProfileLevel.AVCLevel31);

        videoCodec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
        videoCodec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
        
        mediaProjection.registerCallback(new MediaProjection.Callback() {}, null);
        
        virtualDisplay = mediaProjection.createVirtualDisplay("ScreenStreamer",
                width, height, density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                videoCodec.createInputSurface(), null, null);

        videoCodec.start();
        isStreaming = true;

        new Thread(() -> {
            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            try {
                while (isStreaming) {
                    int outputBufferId = videoCodec.dequeueOutputBuffer(bufferInfo, 10000);
                    if (outputBufferId >= 0) {
                        ByteBuffer outputBuffer = videoCodec.getOutputBuffer(outputBufferId);
                        if (outputBuffer != null) {
                            outputBuffer.position(bufferInfo.offset);
                            outputBuffer.limit(bufferInfo.offset + bufferInfo.size);
                            byte[] outData = new byte[bufferInfo.size];
                            outputBuffer.get(outData);

                            if ((bufferInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                                // Append SPS/PPS buffers together if they come separately
                                if (spsPpsCache == null) {
                                    spsPpsCache = outData;
                                } else {
                                    byte[] combined = new byte[spsPpsCache.length + outData.length];
                                    System.arraycopy(spsPpsCache, 0, combined, 0, spsPpsCache.length);
                                    System.arraycopy(outData, 0, combined, spsPpsCache.length, outData.length);
                                    spsPpsCache = combined;
                                }
                            } else {
                                for (OutputStream out : clients) {
                                    try {
                                        out.write(outData);
                                    } catch (Exception e) {
                                        clients.remove(out);
                                    }
                                }
                            }
                        }
                        videoCodec.releaseOutputBuffer(outputBufferId, false);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void startServer() {
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
            if (spsPpsCache != null) {
                out.write(spsPpsCache);
            }
            clients.add(out);
            
            // Critical Fix: Force an I-Frame to be generated immediately so the new client can start decoding.
            // A decoder cannot start decoding from a P-frame even if it has the SPS/PPS headers.
            if (videoCodec != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                Bundle b = new Bundle();
                b.putInt(MediaCodec.PARAMETER_KEY_REQUEST_SYNC_FRAME, 0);
                videoCodec.setParameters(b);
            }
        } catch (Exception e) {
            e.printStackTrace();
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
        if (mediaProjection != null) mediaProjection.stop();
        
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (Exception e) {}
        
        clients.clear();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }
}
