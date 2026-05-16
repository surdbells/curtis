package com.rainbeta.curtistracker;

import android.app.ProgressDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v7.app.AppCompatActivity;
import android.telephony.TelephonyManager;
import android.text.TextUtils;
import android.view.View;
import android.widget.ArrayAdapter;
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

import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import static java.nio.charset.StandardCharsets.UTF_16;

public class DailyActivity extends AppCompatActivity implements ConnectivityReceiver.ConnectivityReceiverListener {
    private FirebaseDatabase database;
    private FirebaseAuth firebaseAuth;
    private ProgressDialog progressDialog;

    public static final String TRUCK_ID = "truckid";
    public static final String MILEAGE = "mileage";
    public static final String FUEL_LEVEL = "gaslevel";
    public static final String USER_ID = "userid";
    public static final String DATE_NOW = "DateTime";
    public static final String DEVICE_ID = "deviceId";
    public static final String CURRENT_STATUS = "status";
    public static final String LONGITUDE = "longitude";
    public static final String LATITUDE = "latitude";
    String CurLongitude;
    String CurLatitude;
    private SearchableSpinner truckSpinner;
    private FusedLocationProviderClient CurtisLocationClient;
    protected Location mLastLocation;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_daily);
        // checkConnection();
        firebaseAuth = FirebaseAuth.getInstance();
        progressDialog = new ProgressDialog(this);
        CurtisLocationClient = LocationServices.getFusedLocationProviderClient(this);
        getLastLocation();
        loadTrucks();
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

                           // Toast.makeText(DailyActivity.this, "Longitude is " + CurLongitude, Toast.LENGTH_SHORT).show();
                           // Toast.makeText(DailyActivity.this, "Latitude is " + CurLatitude, Toast.LENGTH_SHORT).show();
                        } else {
                            Toast.makeText(DailyActivity.this, "Location Not Detected, Try Again ", Toast.LENGTH_SHORT).show();
                        }
                    }
                });

    }

    public void loadTrucks() {
        progressDialog.setMessage("Loading Trucks");
        progressDialog.show();
        database = FirebaseDatabase.getInstance();
        final RequestQueue queue = Volley.newRequestQueue(this);
        // Request a string response from the provided URL.
        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                String baseUrlValue = (String) dataSnapshot.getValue();
                Toast.makeText(DailyActivity.this, baseUrlValue, Toast.LENGTH_LONG).show();
                //get truck by user ID
                final String url = baseUrlValue + "gettrucks";
                StringRequest stringRequest = new StringRequest(Request.Method.GET, url,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                InputStream stream = new ByteArrayInputStream(response.getBytes(UTF_16));
                                DocumentBuilder builder = null;
                                try {
                                    builder = DocumentBuilderFactory.newInstance()
                                            .newDocumentBuilder();
                                } catch (ParserConfigurationException e) {
                                    e.printStackTrace();
                                }
                                Document doc = null;
                                try {
                                    assert builder != null;
                                    doc = builder.parse(stream);
                                } catch (SAXException | IOException e) {
                                    e.printStackTrace();
                                }
                                String trucks = "";
                                if (doc != null) {
                                    NodeList nl = doc.getElementsByTagName("trucks");
                                    if (nl.getLength() > 0) {
                                        Node node = nl.item(0);
                                        trucks = node.getTextContent();
                                    }
                                }
                                // Return trucks
                                String[] newTrucks = trucks.trim().split("\n");
                                String mainTrucks = Arrays.toString(newTrucks).replace("[", "").replace("]", "");
                                mainTrucks = mainTrucks.replaceAll("\\s","");
                                String[] newMainTrucks = mainTrucks.split(",");
                                final ArrayList<String> truckList = new ArrayList<>(Arrays.asList(newMainTrucks));


                                // Spinner spinner = (Spinner) findViewById(R.id.spinner);
                                truckSpinner = (SearchableSpinner) findViewById(R.id.spinner);
                                ArrayAdapter<String> arrayAdapter = new ArrayAdapter<>(DailyActivity.this, android.R.layout.simple_spinner_item, truckList);
                                arrayAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
                                truckSpinner.setAdapter(arrayAdapter);
                                progressDialog.dismiss();

                            }
                        }, new Response.ErrorListener() {
                    @Override
                    public void onErrorResponse(VolleyError error) {
                        Toast.makeText(DailyActivity.this, "No response from Server", Toast.LENGTH_SHORT).show();

                    }
                });
                // Add the request to the RequestQueue.
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                queue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(DailyActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

    }
    public void start_end_day(View view) {
        TelephonyManager telephonyManager;
        telephonyManager = (TelephonyManager) getSystemService(Context.
                TELEPHONY_SERVICE);
        if (ActivityCompat.checkSelfPermission(DailyActivity.this, android.Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
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
                EditText curMileage = (EditText) findViewById(R.id.mileage);
                Spinner curFuel = (Spinner) findViewById(R.id.fuel);
                Spinner curStatus = (Spinner) findViewById(R.id.statusSelect);

                progressDialog.setMessage("Processing your request...");
                progressDialog.show();
                String baseUrlValue = (String) dataSnapshot.getValue();
                Toast.makeText(DailyActivity.this, baseUrlValue, Toast.LENGTH_SHORT).show();
                //getting current user
                FirebaseUser user = firebaseAuth.getCurrentUser();
                Date now = new Date();
                SimpleDateFormat currentDate = new SimpleDateFormat("dd/MM/yyyy hh:mm aaa");
                final String userID = user.getUid();
                final String dateNow =  currentDate.format(now);

                final String API_URL = baseUrlValue + "start_day";

               final String selectedTruck = truckSpinner.getSelectedItem().toString().trim();
               final String inputMileage = curMileage.getText().toString().trim();
                if(TextUtils.isEmpty(inputMileage)){
                    Toast.makeText(DailyActivity.this,"Enter Mileage..",Toast.LENGTH_LONG).show();
                    return;
                }

               final String selectedFuelLevel = curFuel.getSelectedItem().toString().trim();
               final String selectedStatus = curStatus.getSelectedItem().toString().trim();

                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                Toast.makeText(DailyActivity.this, response, Toast.LENGTH_LONG).show();
                                Intent sendOff = new Intent(DailyActivity.this, DeliveryActivity.class);
                                startActivity(sendOff);
                                progressDialog.dismiss();
                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                Toast.makeText(DailyActivity.this, "Not completed, Try Again", Toast.LENGTH_LONG).show();
                            }
                        }){
                    @Override
                    protected Map<String,String> getParams(){
                        Map<String,String> params = new HashMap<>();
                        params.put(TRUCK_ID, selectedTruck);
                        params.put(MILEAGE, inputMileage);
                        params.put(FUEL_LEVEL, selectedFuelLevel);
                        params.put(USER_ID, userID);
                        params.put(DATE_NOW, dateNow);
                        params.put(CURRENT_STATUS, selectedStatus);
                        params.put(DEVICE_ID, deviceId);
                        params.put(LONGITUDE, CurLongitude);
                        params.put(LATITUDE, CurLatitude);
                        return params;
                    }

                };

                RequestQueue requestQueue = Volley.newRequestQueue(DailyActivity.this);
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(DailyActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });


    }

  /*  private void checkConnection() {
        boolean isConnected = ConnectivityReceiver.isConnected();
        showToast(isConnected);
    }
*/
    public boolean isInternetAvailable(String address, int port, int timeoutMs) {
        try {
            Socket sock = new Socket();
            SocketAddress sockaddr = new InetSocketAddress(address, port);
            sock.connect(sockaddr, timeoutMs); // This will block no more than timeoutMs
            sock.close();
            return true;
        } catch (IOException e) { return false; }
    }



    // Showing the status Toast
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
                                Toast.makeText(getApplicationContext(),"Your Internet is Active",Toast.LENGTH_SHORT).show();
                            }
                        });
                    } else {

                        runOnUiThread(new Runnable() {
                            public void run() {
                                Toast.makeText(getApplicationContext(),"Your Internet is not Active",Toast.LENGTH_SHORT).show();
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

        Toast.makeText(getApplicationContext(),message,Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onResume() {
        super.onResume();

        // register connection status listener
        BaseApplication.getInstance().setConnectivityListener(this);
    }

    @Override
    public void onNetworkConnectionChanged(boolean isConnected) {
        showToast(isConnected);
    }

}
