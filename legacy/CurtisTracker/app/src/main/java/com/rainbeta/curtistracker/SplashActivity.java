package com.rainbeta.curtistracker;

import android.Manifest;
import android.app.Activity;
import android.app.ProgressDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.telephony.TelephonyManager;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.android.volley.toolbox.Volley;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;

public class SplashActivity extends Activity implements ConnectivityReceiver.ConnectivityReceiverListener {
    // Splash screen timer
    private static int SPLASH_TIME_OUT = 1000;
    private FirebaseDatabase database;
    private ProgressDialog progressDialog;
    private TextView status;
    private FirebaseAuth firebaseAuth;



    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);
        requestPermissionState();
        database = FirebaseDatabase.getInstance();
        progressDialog = new ProgressDialog(this);
        status = (TextView) findViewById(R.id.instate);
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                checkConnection();
            }
        }, SPLASH_TIME_OUT);

        status.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                checkConnection();
            }
        });
    }


    public void authorize() {
            TelephonyManager telephonyManager;
            telephonyManager = (TelephonyManager) getSystemService(Context.
                    TELEPHONY_SERVICE);
            if (ActivityCompat.checkSelfPermission(SplashActivity.this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            final String deviceId = telephonyManager.getDeviceId();
            DatabaseReference myRef = database.getReference("baseUrl");
            myRef.addValueEventListener(new ValueEventListener() {
                @Override
                public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                    progressDialog.setMessage("Validating Device...");
                    progressDialog.show();
                    progressDialog.setCancelable(false);
                    String baseUrlValue = (String) dataSnapshot.getValue();
                    final String API_URL = baseUrlValue + "ValidateDevice/" + deviceId;

                    StringRequest stringRequest = new StringRequest(Request.Method.GET, API_URL,
                            new Response.Listener<String>() {
                                @Override
                                public void onResponse(String response) {
                                    if(response.contains("success")) {
                                        progressDialog.dismiss();
                                        Toast.makeText(SplashActivity.this, response, Toast.LENGTH_LONG).show();
                                        Intent i = new Intent(SplashActivity.this, SignupActivity.class);
                                        startActivity(i);
                                    } else {
                                        progressDialog.dismiss();
                                        finish();
                                    }
                                }
                            },
                            new Response.ErrorListener() {
                                @Override
                                public void onErrorResponse(VolleyError error) {
                                    progressDialog.dismiss();
                                    Toast.makeText(SplashActivity.this, "Not completed, Pls Try Again", Toast.LENGTH_LONG).show();
                                }
                            }){

                    };

                    RequestQueue requestQueue = Volley.newRequestQueue(SplashActivity.this);
                    requestQueue.add(stringRequest);
                }
                @Override
                public void onCancelled(@NonNull DatabaseError databaseError) {
                    Toast.makeText(SplashActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
    }
    public boolean isInternetAvailable(String address, int port, int timeoutMs) {
        try {
            Socket sock = new Socket();
            SocketAddress sockaddr = new InetSocketAddress(address, port);
            sock.connect(sockaddr, timeoutMs); // This will block no more than timeoutMs
            sock.close();
            return true;
        } catch (IOException e) { return false; }
    }
    private void checkConnection() {
        boolean isConnected = ConnectivityReceiver.isConnected();
        if (isConnected) {
            status.setText("Internet Active");

            firebaseAuth = FirebaseAuth.getInstance();
            if(firebaseAuth.getCurrentUser() != null){
                finish();
                startActivity(new Intent(getApplicationContext(), DashboardActivity.class));
            } else {
                Intent i = new Intent(SplashActivity.this, SignupActivity.class);
                startActivity(i);
            }


        } else {
            Toast.makeText(this, "Connect Active Internet Connection.", Toast.LENGTH_SHORT).show();
            status.setText("Not Connected, Click to Retry");
        }

    }
    private void showToast(boolean isConnected) {
        String message;
        if (isConnected) {
            message = "Good! Connected to Internet";
            Thread thread = new Thread(new Runnable(){
                public void run() {
                    if (isInternetAvailable("216.58.212.110", 80, 1000)) {
                        // Internet available, do something
                        runOnUiThread(new Runnable() {
                            public void run() {
                                Toast.makeText(getApplicationContext(),"Your Internet is Active", Toast.LENGTH_SHORT).show();
                            }
                        });
                    } else {
                        runOnUiThread(new Runnable() {
                            public void run() {
                                Toast.makeText(getApplicationContext(),"Your Internet is not Active", Toast.LENGTH_SHORT).show();
                            }
                        });
                        // Internet not available
                    }
                }
            });
            thread.start();

        } else {
            message = "Sorry! Not connected to internet";
        }

        Toast.makeText(getApplicationContext(),message, Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onResume() {
        super.onResume();
        BaseApplication.getInstance().setConnectivityListener(this);
    }

    @Override
    public void onNetworkConnectionChanged(boolean isConnected) {
        showToast(isConnected);
    }

    @Override
    public void onBackPressed() {
        //
    }

    public void requestPermissionState() {
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED ) {
            int REQUEST_CODE_ASK_PERMISSIONS_TWO = 321;
            ActivityCompat
                    .requestPermissions(SplashActivity.this, new String[]{android.Manifest.permission.READ_PHONE_STATE}, REQUEST_CODE_ASK_PERMISSIONS_TWO);
        }
    }

}
