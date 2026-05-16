package com.rainbeta.curtistracker;

import android.app.ProgressDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.BatteryManager;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v7.app.AppCompatActivity;
import android.os.Bundle;
import android.telephony.TelephonyManager;
import android.text.TextUtils;
import android.view.View;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.Toast;

import com.android.volley.DefaultRetryPolicy;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.android.volley.toolbox.Volley;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.toptoche.searchablespinnerlibrary.SearchableSpinner;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

public class IncidentActivity extends AppCompatActivity {
    private FirebaseDatabase database;
    private FirebaseAuth firebaseAuth;
    private ProgressDialog progressDialog;

    public static final String INCIDENT_SUMMARY = "note";
    public static final String INCIDENT_TYPE = "incidentType";
    public static final String BATTERY_LEVEL = "batteryLevel";
    public static final String USER_ID = "userid";
    public static final String DATE_NOW = "DateTime";
    public static final String DEVICE_ID = "deviceId";
    public static final String LONGITUDE = "longitude";
    public static final String LATITUDE = "latitude";
    String CurLongitude;
    String CurLatitude;
    String batteryLevel;

    private SearchableSpinner truckSpinner;
    private FusedLocationProviderClient CurtisLocationClient;
    protected Location mLastLocation;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_incident);

        // Getting Battery Info
        BatteryManager bm = (BatteryManager)getSystemService(BATTERY_SERVICE);
        int batLevel = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        batteryLevel = String.valueOf(batLevel);
        //    Toast.makeText(this, String.valueOf(batLevel), Toast.LENGTH_LONG).show();

        firebaseAuth = FirebaseAuth.getInstance();
        progressDialog = new ProgressDialog(this);
        database = FirebaseDatabase.getInstance();

        CurtisLocationClient = LocationServices.getFusedLocationProviderClient(this);
        getLastLocation();
    }

    public void getLastLocation() {
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
        CurtisLocationClient.getLastLocation()
                .addOnCompleteListener(this, new OnCompleteListener<Location>() {
                    @Override
                    public void onComplete(@NonNull Task<Location> task) {
                        if (task.isSuccessful() && task.getResult() != null) {
                            mLastLocation = task.getResult();

                            CurLongitude = String.valueOf(mLastLocation.getLongitude());
                            CurLatitude = String.valueOf(mLastLocation.getLatitude());

                            // Toast.makeText(IncidentActivity.this, "Longitude is " + CurLongitude, Toast.LENGTH_SHORT).show();
                            // Toast.makeText(IncidentActivity.this, "Latitude is " + CurLatitude, Toast.LENGTH_SHORT).show();
                        } else {
                            Toast.makeText(IncidentActivity.this, "Location Not Detected, Try Again ", Toast.LENGTH_SHORT).show();
                        }
                    }
                });

    }
    public void PostIncident(View view) {
        TelephonyManager telephonyManager;
        telephonyManager = (TelephonyManager) getSystemService(Context.
                TELEPHONY_SERVICE);
        if (ActivityCompat.checkSelfPermission(IncidentActivity.this, android.Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
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
        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                EditText enote = (EditText) findViewById(R.id.moreinfo_field);
                Spinner evtype = (Spinner) findViewById(R.id.evselect);

                progressDialog.setMessage("Processing your request...");
                progressDialog.show();
                String baseUrlValue = (String) dataSnapshot.getValue();
                Toast.makeText(IncidentActivity.this, baseUrlValue, Toast.LENGTH_SHORT).show();
                //getting current user
                FirebaseUser user = firebaseAuth.getCurrentUser();
                Date now = new Date();
                SimpleDateFormat currentDate = new SimpleDateFormat("dd/MM/yyyy hh:mm aaa");
                final String userID = user.getUid();
                final String dateNow =  currentDate.format(now);

                final String API_URL = baseUrlValue + "PostIncident";

                final String mEvent = evtype.getSelectedItem().toString().trim();
                final String note = enote.getText().toString().trim();
                if(TextUtils.isEmpty(note)){
                    Toast.makeText(IncidentActivity.this,"Provide Explanatory Note..",Toast.LENGTH_LONG).show();
                    return;
                }


                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                Toast.makeText(IncidentActivity.this, response, Toast.LENGTH_LONG).show();
                                Intent sendOff = new Intent(IncidentActivity.this, DashboardActivity.class);
                                startActivity(sendOff);
                                progressDialog.dismiss();
                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                Toast.makeText(IncidentActivity.this, "Not completed, Try Again", Toast.LENGTH_LONG).show();
                            }
                        }){
                    @Override
                    protected Map<String,String> getParams(){
                        Map<String,String> params = new HashMap<>();
                        params.put(INCIDENT_SUMMARY, note);
                        params.put(INCIDENT_TYPE, mEvent);
                        params.put(BATTERY_LEVEL, batteryLevel);
                        params.put(USER_ID, userID);
                        params.put(DATE_NOW, dateNow);
                        params.put(DEVICE_ID, deviceId);
                        params.put(LONGITUDE, CurLongitude);
                        params.put(LATITUDE, CurLatitude);
                        return params;
                    }

                };

                RequestQueue requestQueue = Volley.newRequestQueue(IncidentActivity.this);
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(IncidentActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });


    }

}
