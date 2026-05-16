package com.rainbeta.curtistracker;

import android.Manifest;
import android.app.ProgressDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.os.Handler;
import android.preference.PreferenceManager;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.support.v7.app.AlertDialog;
import android.support.v7.app.AppCompatActivity;
import android.telephony.TelephonyManager;
import android.text.TextUtils;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
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
import com.google.zxing.Result;
import com.rainbeta.curtistracker.android_serialport_api.Util;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Timer;

import cn.pda.scan.ScanThread;
import me.dm7.barcodescanner.zxing.ZXingScannerView;

public class ProcessActivity extends AppCompatActivity implements  ConnectivityReceiver.ConnectivityReceiverListener, ZXingScannerView.ResultHandler {

    private static String TAGG = ProcessActivity.class.getSimpleName();
    private EditText editTextSealInput;
    private TextView feedbk;
    private ProgressDialog progressDialog;
    private FirebaseDatabase database;
    private FirebaseAuth firebaseAuth;
    private LinearLayout showUpdater, Confirm, scanView, detailsView;
    public static final String REF_NUMBER = "refnumber";
    public static final String USER_ID = "userid";
    public static final String DATE_NOW = "DateTime";
    public static final String CURRENT_STATUS = "status";
    public static final String DEVICE_ID = "deviceId";
    public static final String ACTION = "action";
    public static final String MESSAGE = "note";
    public static final String LONGITUDE = "longitude";
    public static final String LATITUDE = "latitude";
    public static final String BRANCH_ID = "branchId";
    String CurLongitude;
    String CurLatitude;
    private String tBranch;
    private ZXingScannerView mScannerView;
    private Button button;

    private FusedLocationProviderClient CurtisLocationClient;
    protected Location mLastLocation;

    private ScanThread scanThread;
    private Timer scanTimer = null;
    private KeyReceiver keyReceiver;
    private Handler mHandler = new Handler() {
        public void handleMessage(android.os.Message msg) {
            if (msg.what == ScanThread.SCAN) {
                    String data = msg.getData().getString("data");
                    editTextSealInput = findViewById(R.id.editTextSeals);
                    editTextSealInput.setText(data);
                    button.performClick();
                    Log.e(TAGG, "data = " + data);
                    //     Toast.makeText(getApplicationContext(), data, 0).show();
                    // Toast.makeText(RouteActivity.this, data, Toast.LENGTH_SHORT).show();
                    Util.play(1, 0);
                }
        };
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_process);
        feedbk = (TextView) findViewById(R.id.fback4);

        // Scanner Config Start
        Window window = this.getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        try {
            scanThread = new ScanThread(mHandler);
            scanThread.start();
            Util.initSoundPool(this);
            keyReceiver = new KeyReceiver();
            IntentFilter filter = new IntentFilter();
            filter.addAction("android.rfid.FUN_KEY");
            filter.addAction("android.intent.action.FUN_KEY");
            registerReceiver(keyReceiver , filter);
        } catch (Exception e) {
            Toast.makeText(this, "serialport init fail", Toast.LENGTH_SHORT).show();
            return;
            // e.printStackTrace();
        }
        // Scanner Config End
        scanView = findViewById(R.id.scanView);

        final LinearLayout scview = (LinearLayout) findViewById(R.id.scanView);
        mScannerView = new ZXingScannerView(this);
        mScannerView.setFlash(true);
        mScannerView.setAutoFocus(true);
        scview.addView(mScannerView);
        requestCamera();
        android.support.v7.app.ActionBar ab = getSupportActionBar();
        if (ab != null) {
            ab.setDisplayHomeAsUpEnabled(true);
        }
        CurtisLocationClient = LocationServices.getFusedLocationProviderClient(this);
        getLastLocation();
        //initializing firebase authentication object
        firebaseAuth = FirebaseAuth.getInstance();
        database = FirebaseDatabase.getInstance();
        progressDialog = new ProgressDialog(this);
        editTextSealInput = findViewById(R.id.editTextSeals);
        showUpdater = findViewById(R.id.statusUpdate);
        Confirm = findViewById(R.id.mConfirm);
        detailsView = findViewById(R.id.jobdetails);
        //////
        SharedPreferences getListView = PreferenceManager.getDefaultSharedPreferences(ProcessActivity.this);
        final String tName = getListView.getString("CLIENT_NAME", " ");
        final String tDestination = getListView.getString("DESTINATION", " ");
        final String tStatus = getListView.getString("STATUS", " ");
        final String tSeals = getListView.getString("SEALS", " ");
        tBranch = getListView.getString("BRANCH_ID", " ");
        tBranch = tBranch.toUpperCase();

        String[] newSeals = tSeals.trim().split("\n");
        String mainSeals = Arrays.toString(newSeals).replace("[", "").replace("]", "");
        mainSeals = mainSeals.replaceAll("\\s", "");
        String[] newMainSeals = mainSeals.split(",");
        final List<String> sealsList = new ArrayList<>(Arrays.asList(newMainSeals));

        final List<String> sealsCount = new ArrayList<>();

        System.out.println("All Seals Start: " + sealsCount);

        System.out.println("AllSeals: " + sealsList); // Show all Seals in Seals List
        // int countValue = sealsList.size();
        final int sealsValue = sealsList.size(); // Get Size of List

        String sealsString = Integer.toString(sealsValue); // Convert intValue to String to parse to textView
        // Displaying all values on the screen
        TextView lblName = findViewById(R.id.name);
        TextView lblDestination = findViewById(R.id.destination);
        TextView lblStatus = findViewById(R.id.status);
        TextView lblSeals = findViewById(R.id.seals);
        final TextView lblSealsConfirm = findViewById(R.id.count);

        lblName.setText(tName);
        lblDestination.setText(tDestination);
        lblStatus.setText(tStatus);
        lblSeals.setText(sealsString);

        button = findViewById(R.id.serialConfirm);
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {

                String confirming = editTextSealInput.getText().toString().trim();
                if (TextUtils.isEmpty(confirming)) {
                    Toast.makeText(ProcessActivity.this, " Please, Enter a seal number", Toast.LENGTH_LONG).show();
                    return;
                }
                if (sealsList.contains(confirming)) {
                    if (!sealsCount.contains(confirming)) {
                        sealsCount.add(confirming);
                        Toast.makeText(ProcessActivity.this, confirming + " Confirmed successfully", Toast.LENGTH_SHORT).show();
                        editTextSealInput.setText("");
                        feedbk.setText(confirming + ": Confirmed successfully");
                        feedbk.setTextColor(getResources().getColor(R.color.bg_login));
                        int countValue = sealsCount.size();
                        if (sealsValue == countValue) {
                            Toast.makeText(ProcessActivity.this, " All Seals Confirmed", Toast.LENGTH_LONG).show();
                            feedbk.setText(confirming + ": All Seals Confirmed");
                            feedbk.setTextColor(getResources().getColor(R.color.bg_login));
                            scanThread.close();
                            Confirm.setVisibility(View.GONE);
                            showUpdater.setVisibility(View.VISIBLE);
                            detailsView.setVisibility(View.GONE);
                            scanView.setVisibility(View.GONE);
                        }
                        String countString = Integer.toString(countValue);
                      //  System.out.println("All Seals: " + sealsCount);
                      //  System.out.println("Count Size: " + countString);
                        lblSealsConfirm.setText(countString);
                    } else {
                        Toast.makeText(ProcessActivity.this, confirming + "Has been counted", Toast.LENGTH_SHORT).show();
                        feedbk.setText(confirming + ": Has been counted");
                        feedbk.setTextColor(getResources().getColor(R.color.bg_login));
                        editTextSealInput.setText("");
                    }

                } else if(confirming.toUpperCase().contains(tBranch)) {
                    feedbk.setText("CheckIn Successfully");
                    feedbk.setTextColor(getResources().getColor(R.color.colorPrimaryDark));
                    check_in();
                    editTextSealInput.setText("");
                } else {
                    Toast.makeText(ProcessActivity.this, "Not found please confirm", Toast.LENGTH_SHORT).show();
                    System.out.println("The Branch Id: " + tBranch);
                    feedbk.setText(confirming + ": Not found please confirm");
                    feedbk.setTextColor(getResources().getColor(R.color.colorAccent));
                    editTextSealInput.setText("");
                }
            }

        });
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.activity_proc_actions, menu);
        return super.onCreateOptionsMenu(menu);
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Take appropriate action for each action item click
        switch (item.getItemId()) {
            case R.id.check_in:
                check_in_start();
                return true;

            case R.id.flash:
                mScannerView.setFlash(true);
                return true;

            case R.id.check_out:
                check_out();
                return true;

            case R.id.qrmode:
                mScannerView.startCamera();
                mScannerView.setFlash(false);
                return true;
            default:
                return super.onOptionsItemSelected(item);
        }
    }
    public void getLastLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
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
                        } else {
                            Toast.makeText(ProcessActivity.this, "Location not Found, Try Again", Toast.LENGTH_SHORT).show();
                        }
                    }
                });

    }
    public void UpdateStatus(View view){
        TelephonyManager telephonyManager;
        telephonyManager = (TelephonyManager) getSystemService(Context.
                TELEPHONY_SERVICE);
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
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
            public void onDataChange(DataSnapshot dataSnapshot) {
                progressDialog.setMessage("Processing your request...");
                progressDialog.show();
                String baseUrlValue = (String) dataSnapshot.getValue();
               /// Toast.makeText(ProcessActivity.this, baseUrlValue, Toast.LENGTH_SHORT).show();
                SharedPreferences getListView = PreferenceManager.getDefaultSharedPreferences(ProcessActivity.this);
                //getting current user
                FirebaseUser user = firebaseAuth.getCurrentUser();
                Date now = new Date();
                SimpleDateFormat currentDate = new SimpleDateFormat("dd/MM/yyyy hh:mm aaa");
                final Spinner setStatus = findViewById(R.id.mainStatus);
                final String Status = setStatus.getSelectedItem().toString().trim();
                final String tRefNumber = getListView.getString("REF_NUMBER", " ");
                final String userID = user.getUid();
                final String dateNow =  currentDate.format(now);
                final String API_URL = baseUrlValue + "PostStatusByUserId";


                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                if (response.contains("00")) {
                                    Intent intent = new Intent(ProcessActivity.this, SignatureActivity.class);
                                    intent.putExtra("Job_id", tRefNumber);
                                    startActivity(intent);
                                } else {
                                    Toast.makeText(ProcessActivity.this, response, Toast.LENGTH_LONG).show();
                                    Intent intent = new Intent(ProcessActivity.this, DeliveryActivity.class);
                                    startActivity(intent);
                                    progressDialog.dismiss();
                                }

                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                Toast.makeText(ProcessActivity.this, "Not completed, Pls Try Again", Toast.LENGTH_LONG).show();
                            }
                        }){
                    @Override
                    protected Map<String,String> getParams(){
                        Map<String,String> params = new HashMap<String, String>();
                            params.put(REF_NUMBER, tRefNumber);
                            params.put(USER_ID, userID);
                            params.put(DATE_NOW, dateNow);
                            params.put(CURRENT_STATUS, Status);
                            params.put(DEVICE_ID, deviceId);
                        return params;
                    }

                };

                RequestQueue requestQueue = Volley.newRequestQueue(ProcessActivity.this);
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(DatabaseError databaseError) {
                Toast.makeText(ProcessActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

    }
    public void check_in_start() {
        mScannerView.setAutoFocus(true);
        mScannerView.startCamera();
    }
    public void check_in() {
        TelephonyManager telephonyManager;
        telephonyManager = (TelephonyManager) getSystemService(Context.
                TELEPHONY_SERVICE);
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
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
            public void onDataChange(DataSnapshot dataSnapshot) {
                progressDialog.setMessage("CheckIn in Progress...");
                progressDialog.show();
                String baseUrlValue = (String) dataSnapshot.getValue();
                // Toast.makeText(ProcessActivity.this, baseUrlValue, Toast.LENGTH_SHORT).show();
                SharedPreferences getListView = PreferenceManager.getDefaultSharedPreferences(ProcessActivity.this);
                //getting current user
                FirebaseUser user = firebaseAuth.getCurrentUser();
                Date now = new Date();
                SimpleDateFormat currentDate = new SimpleDateFormat("dd/MM/yyyy hh:mm aaa");
                final String tRefNumber = getListView.getString("REF_NUMBER", " ");
                final String userID = user.getUid();
                final String dateNow =  currentDate.format(now);
                final String curAction = "check_in";
                final String branchID = tBranch;

                final String API_URL = baseUrlValue + "check_in";

                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                Toast.makeText(ProcessActivity.this, response, Toast.LENGTH_LONG).show();
                                progressDialog.dismiss();
                                scanView.setVisibility(View.GONE);
                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                Toast.makeText(ProcessActivity.this, "Not completed, Try Again", Toast.LENGTH_LONG).show();
                            }
                        }){
                    @Override
                    protected Map<String,String> getParams(){
                        Map<String,String> params = new HashMap<String, String>();
                        params.put(REF_NUMBER, tRefNumber);
                        params.put(USER_ID, userID);
                        params.put(DATE_NOW, dateNow);
                        params.put(ACTION, curAction);
                        params.put(DEVICE_ID, deviceId);
                        params.put(LONGITUDE, CurLongitude);
                        params.put(LATITUDE, CurLatitude);
                        params.put(BRANCH_ID, branchID);
                        return params;
                    }

                };

                RequestQueue requestQueue = Volley.newRequestQueue(ProcessActivity.this);
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(ProcessActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

    }
    public void check_out() {

        TelephonyManager telephonyManager;
        telephonyManager = (TelephonyManager) getSystemService(Context.
                TELEPHONY_SERVICE);
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
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

        AlertDialog.Builder alertDialog = new AlertDialog.Builder(ProcessActivity.this);
        alertDialog.setTitle("CONFIRM CHECK OUT");
        alertDialog.setMessage("Note:");
        final EditText input = new EditText(ProcessActivity.this);
        input.setHint("Summary");
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT);
        input.setLayoutParams(lp);
        alertDialog.setView(input);
        alertDialog.setPositiveButton("CONFIRM", new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int which) {
                        // Start Send data.
                        DatabaseReference myRef = database.getReference("baseUrl");
                        myRef.addValueEventListener(new ValueEventListener() {
                            @Override
                            public void onDataChange(DataSnapshot dataSnapshot) {
                                progressDialog.setMessage("Processing your request...");
                                progressDialog.show();
                                String baseUrlValue = (String) dataSnapshot.getValue();
                                // Toast.makeText(ProcessActivity.this, baseUrlValue, Toast.LENGTH_SHORT).show();
                                SharedPreferences getListView = PreferenceManager.getDefaultSharedPreferences(ProcessActivity.this);
                                //getting current user
                                FirebaseUser user = firebaseAuth.getCurrentUser();
                                Date now = new Date();
                                SimpleDateFormat currentDate = new SimpleDateFormat("dd/MM/yyyy hh:mm aaa");
                                final String tRefNumber = getListView.getString("REF_NUMBER", " ");
                                final String userID = user.getUid();
                                final String dateNow =  currentDate.format(now);
                                final String curAction = "check_out";
                                final String message = input.getText().toString().trim();

                                final String API_URL = baseUrlValue + "check_out";

                                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                                        new Response.Listener<String>() {
                                            @Override
                                            public void onResponse(String response) {
                                                Toast.makeText(ProcessActivity.this, response, Toast.LENGTH_LONG).show();
                                                Intent intent = new Intent (ProcessActivity.this, DeliveryActivity.class);
                                                startActivity(intent);
                                                progressDialog.dismiss();
                                            }
                                        },
                                        new Response.ErrorListener() {
                                            @Override
                                            public void onErrorResponse(VolleyError error) {
                                                Toast.makeText(ProcessActivity.this, "Not completed, Try Again", Toast.LENGTH_LONG).show();
                                            }
                                        }){
                                    @Override
                                    protected Map<String,String> getParams(){
                                        Map<String,String> params = new HashMap<>();
                                            params.put(REF_NUMBER, tRefNumber);
                                            params.put(USER_ID, userID);
                                            params.put(DATE_NOW, dateNow);
                                            params.put(ACTION, curAction);
                                            params.put(DEVICE_ID, deviceId);
                                            params.put(MESSAGE, message);
                                            params.put(LONGITUDE, CurLongitude);
                                            params.put(LATITUDE, CurLatitude);
                                        return params;
                                    }

                                };

                                RequestQueue requestQueue = Volley.newRequestQueue(ProcessActivity.this);
                                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                                        5000,
                                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                                requestQueue.add(stringRequest);
                            }
                            @Override
                            public void onCancelled(DatabaseError databaseError) {
                                Toast.makeText(ProcessActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
                            }
                        });
                        // Send Data End
                    }
                });

        alertDialog.setNegativeButton("DECLINE",
                new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int which) {
                        Toast.makeText(ProcessActivity.this, "Continue Process.", Toast.LENGTH_SHORT).show();
                        dialog.cancel();
                    }
                });

        alertDialog.show();

    }
    private void requestCamera() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED ) {
            int REQUEST_CODE_ASK_PERMISSIONS = 123;
            ActivityCompat
                    .requestPermissions(ProcessActivity.this, new String[]{Manifest.permission.CAMERA}, REQUEST_CODE_ASK_PERMISSIONS);
        }
    }


/*
    @Override
    public void onBarCodeData(final String data) {
        mhandler.post(new Runnable() {
            @Override
            public void run() {
                if (Objects.equals(data, "null")) {
                    api.CloseScanning();
                } else {
                    EditText seals = findViewById(R.id.editTextSeals);
                    Button confirm = findViewById(R.id.serialConfirm);
                    seals.setText(data);
                    confirm.performClick();
                    seals.setTextIsSelectable(false);
                    api.CloseScanning();
                }
            }
        });
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
    public void onNetworkConnectionChanged(boolean isConnected) {
        showToast(isConnected);
    }

    @Override
    public void handleResult(Result rawResult) {
        Toast.makeText(ProcessActivity.this, rawResult.getText(), Toast.LENGTH_SHORT).show();
        String rsult = rawResult.getText();
        rsult = rsult.toUpperCase();
            if(rsult.equals(tBranch)) {
                check_in();
            } else {
                editTextSealInput.setText(rawResult.getText());
                button.performClick();
                Handler handler = new Handler();
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        mScannerView.resumeCameraPreview(ProcessActivity.this);
                    }
                }, 2000);
            }

    }

    long exitSytemTime = 0;
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_HOME) {
            scanThread.scan();
        }

        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (System.currentTimeMillis() - exitSytemTime > 2000) {
                Toast.makeText(getApplicationContext(), R.string.exitSystem,
                        Toast.LENGTH_SHORT).show();
                exitSytemTime = System.currentTimeMillis();
                return true;
            } else {
                finish();
            }
        }
        return super.onKeyDown(keyCode, event);
    }
    @Override
    protected void onDestroy() {
        if(scanTimer!= null){
            scanTimer.cancel();
        }
        if (scanThread != null) {
            scanThread.interrupt();
            scanThread.close();
        }

        //ע���㲥������
        unregisterReceiver(keyReceiver);
        super.onDestroy();
    }
    // Scanner Key Receiver
    private boolean mIsPressed = false;
    private class KeyReceiver extends BroadcastReceiver {

        @Override
        public void onReceive(Context context, Intent intent) {
            int keyCode = intent.getIntExtra("keyCode", 0);
            // Ϊ�������ڰ汾����
            if (keyCode == 0) {
                keyCode = intent.getIntExtra("keycode", 0);
            }
            boolean keyDown = intent.getBooleanExtra("keydown", false);
            if (keyDown && !mIsPressed) {
                // ������Ҫ�ڶ�Ӧ�İ����ļ�ֵ�п���ɨ��,
                switch (keyCode) {
                    case KeyEvent.KEYCODE_F1:

                    case KeyEvent.KEYCODE_F2:

                    case KeyEvent.KEYCODE_F3:

                    case KeyEvent.KEYCODE_F4:

                    case KeyEvent.KEYCODE_F5:

                    default:
                        //����ɨ��
                        mIsPressed = true;
                        scanThread.scan();
                        break;
                }
            }else {
                mIsPressed = false;
            }
        }
    }
}

