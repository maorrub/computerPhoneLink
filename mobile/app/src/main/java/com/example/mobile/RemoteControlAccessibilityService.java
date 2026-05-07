package com.example.mobile;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.view.accessibility.AccessibilityEvent;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.ServerSocket;
import java.net.Socket;

public class RemoteControlAccessibilityService extends AccessibilityService {

    private static final int PORT = 8081;
    private ServerSocket serverSocket;
    private boolean isListening = false;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        startServer();
    }

    private void startServer() {
        isListening = true;
        new Thread(() -> {
            try {
                serverSocket = new ServerSocket(PORT);
                while (isListening) {
                    Socket clientSocket = serverSocket.accept();
                    handleClient(clientSocket);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void handleClient(Socket clientSocket) {
        new Thread(() -> {
            try {
                BufferedReader reader = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
                String line;
                while ((line = reader.readLine()) != null) {
                    try {
                        JSONObject json = new JSONObject(line);
                        String action = json.optString("action");
                        if ("tap".equals(action)) {
                            int x = json.optInt("x");
                            int y = json.optInt("y");
                            performTap(x, y);
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private void performTap(int x, int y) {
        Path clickPath = new Path();
        clickPath.moveTo(x, y);
        GestureDescription.StrokeDescription stroke = new GestureDescription.StrokeDescription(clickPath, 0, 100);
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(stroke);
        dispatchGesture(builder.build(), null, null);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Not used
    }

    @Override
    public void onInterrupt() {
        // Not used
    }

    @Override
    public boolean onUnbind(android.content.Intent intent) {
        isListening = false;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
        return super.onUnbind(intent);
    }
}
