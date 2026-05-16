package com.rainbeta.curtistracker;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.BatteryManager;
import android.os.IBinder;
import android.os.Looper;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.telephony.TelephonyManager;
import android.util.Log;
import android.widget.Toast;

import com.android.volley.AuthFailureError;
import com.android.volley.DefaultRetryPolicy;
import com.android.volley.NetworkError;
import com.android.volley.NoConnectionError;
import com.android.volley.ParseError;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.ServerError;
import com.android.volley.TimeoutError;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.android.volley.toolbox.Volley;
import com.google.android.gms.common.api.GoogleApiClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.SettingsClient;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import static com.google.android.gms.location.LocationServices.getFusedLocationProviderClient;

public class TrackerService extends Service {

    private LocationRequest mLocationRequest;
    private GoogleApiClient mGoogleApiClient;

    // private long UPDATE_INTERVAL = 80 * 6000; /* 480 seconds */
   // private long FASTEST_INTERVAL = 50 * 6000; /* 300 seconds */
    private long NEW_DUO_INTERVAL;

    private static final String TAG = "TrackerService";
    private FirebaseDatabase database;
    private FirebaseAuth firebaseAuth;
    public static final String USER_ID = "userid";
    public static final String LONGITUDE = "longitude";
    public static final String LATITUDE = "latitude";
    public static final String DATE_NOW = "DateTime";
    public static final String DEVICE_ID = "deviceId";
    public static final String BATTERY_LEVEL = "batterylevel";


    String CurLongitude;
    String CurLatitude;
    String batteryLevel;



    protected void startLocationUpdates() {
            final RequestQueue queue = Volley.newRequestQueue(this);
            // Request a string response from the provided URL.
            DatabaseReference myRef = database.getReference("baseUrl");
            myRef.addValueEventListener(new ValueEventListener() {
                @Override
                public void onDataChange(DataSnapshot dataSnapshot) {
                    String baseUrlValue = (String) dataSnapshot.getValue();
                   // Toast.makeText(TrackerService.this, baseUrlValue, Toast.LENGTH_LONG).show();
                    final String url = baseUrlValue + "getInterval";
                    StringRequest stringRequest = new StringRequest(Request.Method.GET, url,
                            new Response.Listener<String>() {
                                @Override
                                public void onResponse(String response) {
                                    String newResponse = response.replaceAll("\"", "");
                                    NEW_DUO_INTERVAL = Long.parseLong(newResponse);
                                    // Receiving Response from server
                                    mLocationRequest.setInterval(NEW_DUO_INTERVAL);
                                    mLocationRequest.setFastestInterval(NEW_DUO_INTERVAL);
                                  //  Toast.makeText(TrackerService.this, "Response From Server: " + newResponse, Toast.LENGTH_SHORT).show();
                                  //  Toast.makeText(TrackerService.this, "Response from Interval: " + String.valueOf(NEW_DUO_INTERVAL), Toast.LENGTH_SHORT).show();
                                }
                            }, new Response.ErrorListener() {
                        @Override
                        public void onErrorResponse(VolleyError error) {
                            Toast.makeText(TrackerService.this, "No response from Server", Toast.LENGTH_SHORT);
                        }
                    });
                    // Add the request to the RequestQueue.
                    queue.add(stringRequest);
                }
                @Override
                public void onCancelled(DatabaseError databaseError) {
                    Toast.makeText(TrackerService.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
                }
            });

        // Create the location request to start receiving updates
        mLocationRequest = new LocationRequest();
        mLocationRequest.setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);
       // mLocationRequest.setInterval(UPDATE_INTERVAL);
       // mLocationRequest.setFastestInterval(FASTEST_INTERVAL);

        // Create LocationSettingsRequest object using location request
        LocationSettingsRequest.Builder builder = new LocationSettingsRequest.Builder();
        builder.addLocationRequest(mLocationRequest);
        LocationSettingsRequest locationSettingsRequest = builder.build();

        // Check whether location settings are satisfied
        // https://developers.google.com/android/reference/com/google/android/gms/location/SettingsClient
        SettingsClient settingsClient = LocationServices.getSettingsClient(this);
        settingsClient.checkLocationSettings(locationSettingsRequest);

        // new Google API SDK v11 uses getFusedLocationProviderClient(this)
        if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            // TODO: Consider calling
            //    ActivityCompat#requestPermissions
            // here to request the missing permissions, and then overriding
            //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
            //                                          int[] grantResults)
            // to handle the case where the user grants the permission. See the documentation
            // for ActivityCompat#requestPermissions for more details.
            return;
        }
        getFusedLocationProviderClient(this).requestLocationUpdates(mLocationRequest, new LocationCallback() {
                    @Override
                    public void onLocationResult(LocationResult locationResult) {
                        // do work here
                        onLocationChanged(locationResult.getLastLocation());
                    }
                },
                Looper.myLooper());
    }
    public void onLocationChanged(Location location) {
        TelephonyManager telephonyManager;
        telephonyManager = (TelephonyManager) getSystemService(Context.
                TELEPHONY_SERVICE);
        if (ActivityCompat.checkSelfPermission(this, android.Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            // TODO: Consider calling
            //    ActivityCompat#requestPermissions
            // here to request the missing permissions, and then overriding
            //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
            //                                          int[] grantResults)
            // to handle the case where the user grants the permission. See the documentation
            // for ActivityCompat#requestPermissions for more details.
            return;
        }
        final String deviceId = telephonyManager.getDeviceId();

        // New location has now been determined
        String msg = "Location Found: " +
                Double.toString(location.getLatitude()) + "," +
                Double.toString(location.getLongitude());
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();

        CurLongitude = String.valueOf(location.getLongitude());
        CurLatitude = String.valueOf(location.getLatitude());
        // You can now create a LatLng Object for use with maps
        // LatLng latLng = new LatLng(location.getLatitude(), location.getLongitude());

        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot dataSnapshot) {
                String baseUrlValue = (String) dataSnapshot.getValue();
                //getting current user
                firebaseAuth = FirebaseAuth.getInstance();
                final FirebaseUser user = firebaseAuth.getCurrentUser();
                final String userID = user != null ? user.getUid() : null;
                Date now = new Date();
                SimpleDateFormat currentDate = new SimpleDateFormat("dd/MM/yyyy hh:mm aaa");
                final String dateNow =  currentDate.format(now);
                final String API_URL = baseUrlValue + "postDeviceLocation";

                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                Toast.makeText(TrackerService.this, response, Toast.LENGTH_LONG).show();
                                                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                String message = null;
                                if (error instanceof NetworkError) {
                                    message = "Cannot connect to Internet...Please check your connection!";
                                } else if (error instanceof ServerError) {
                                    message = "The server could not be found. Please try again after some time!!";
                                } else if (error instanceof AuthFailureError) {
                                    message = "Cannot connect to Internet...Please check your connection!";
                                } else if (error instanceof ParseError) {
                                    message = "Parsing error! Please try again after some time!!";
                                } else if (error instanceof NoConnectionError) {
                                    message = "Cannot connect to Internet...Please check your connection!";
                                } else if (error instanceof TimeoutError) {
                                    message = "Connection TimeOut! Please check your internet connection.";
                                } else {
                                    message = "No Active Logged In user.";
                                }

                                Toast.makeText(TrackerService.this, message, Toast.LENGTH_LONG).show();
                            }
                        }){
                    @Override
                    protected Map<String,String> getParams(){
                        Map<String,String> params = new HashMap<>();
                        params.put(DATE_NOW, dateNow);
                        params.put(DEVICE_ID, deviceId);
                        params.put(BATTERY_LEVEL, batteryLevel);
                        params.put(USER_ID, userID);
                        params.put(LONGITUDE, CurLongitude);
                        params.put(LATITUDE, CurLatitude);

                        return params;
                    }

                };

                RequestQueue requestQueue = Volley.newRequestQueue(TrackerService.this);
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                    requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(TrackerService.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

    }


    @Override
    public IBinder onBind(Intent arg0) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.e(TAG, "onStartCommand");
        super.onStartCommand(intent, flags, startId);
        return START_STICKY;
    }

    @Override
    public void onCreate() {
        FirebaseApp.initializeApp(TrackerService.this);
        database = FirebaseDatabase.getInstance();
        // Getting Battery Info
        BatteryManager bm = (BatteryManager)getSystemService(BATTERY_SERVICE);
        int batLevel = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        batteryLevel = String.valueOf(batLevel);
        //    Toast.makeText(this, String.valueOf(batLevel), Toast.LENGTH_LONG).show();

        startLocationUpdates();
    }

    @Override
    public void onDestroy() {
        //
    }

}