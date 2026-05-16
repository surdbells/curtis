package com.rainbeta.curtistracker;

import android.app.ListActivity;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.preference.PreferenceManager;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.view.View;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.ListAdapter;
import android.widget.ListView;
import android.widget.SimpleAdapter;
import android.widget.TextView;
import android.widget.Toast;

import com.android.volley.DefaultRetryPolicy;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.android.volley.toolbox.Volley;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;
import java.util.ArrayList;
import java.util.HashMap;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import static java.nio.charset.StandardCharsets.UTF_8;

public class DeliveryActivity extends ListActivity implements ConnectivityReceiver.ConnectivityReceiverListener, View.OnClickListener {
    private ProgressDialog progressDialog;
    private FirebaseDatabase database;
    private FirebaseAuth firebaseAuth;
    private Button buttonLogout;
    final private int REQUEST_CODE_ASK_PERMISSIONS = 123;
    static final String KEY_ITEM = "Job"; // parent node
    static final String KEY_REFERENCE_NUMBER = "referenceNumber";
    static final String KEY_REF_NUMBER = "refNo";
    static final String KEY_CLIENT_NAME = "clientName";
    static final String KEY_PICK_UP_LOCATION = "pickupLocation";
    static final String KEY_DESTINATION = "destination";
    static final String KEY_CLIENT_ID = "clientIdNumber";
    static final String KEY_STOP_NUMBER = "stopNumber";
    static final String KEY_STATUS = "status";
    static final String KEY_SEALS = "seals";
    static final String KEY_BRANCH_ID = "branchId";
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_delivery);
        // checkConnection();
        database = FirebaseDatabase.getInstance();
        progressDialog = new ProgressDialog(this);
        requestPermission();
        Button refreshJobs = findViewById(R.id.refreshJobs);
        refreshJobs.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
               loadJobs();
            }
        });
            firebaseAuth = FirebaseAuth.getInstance();
            if(firebaseAuth.getCurrentUser() == null){
                finish();
                startActivity(new Intent(this, MainActivity.class));
            }
            FirebaseUser user = firebaseAuth.getCurrentUser();
            TextView textViewUserEmail = (TextView) findViewById(R.id.textViewUserEmail);
            if (user != null) {
                textViewUserEmail.setText(user.getEmail());
            }
        loadJobs();
    }



    private void requestPermission() {
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED ) {
            ActivityCompat
                    .requestPermissions(DeliveryActivity.this, new String[]{android.Manifest.permission.ACCESS_FINE_LOCATION}, REQUEST_CODE_ASK_PERMISSIONS);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        switch (requestCode) {
            case REQUEST_CODE_ASK_PERMISSIONS:
                if (grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    // Permission Granted
                    Toast.makeText(DeliveryActivity.this, "Permission Granted", Toast.LENGTH_SHORT)
                            .show();
                } else {
                    // Permission Denied
                    Toast.makeText(DeliveryActivity.this, "Permission Denied", Toast.LENGTH_SHORT)
                            .show();
                }
                break;
            default:
                super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        }
    }

    public void loadJobs() {
        progressDialog.setMessage("Processing your request...");
        progressDialog.show();
        final RequestQueue queue = Volley.newRequestQueue(this);
        // Request a string response from the provided URL.
        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                FirebaseUser user = firebaseAuth.getCurrentUser();
                String baseUrlValue = (String) dataSnapshot.getValue();
                String CurrentUser = null;
                if (user != null) {
                    CurrentUser = user.getUid();
                }
               // Toast.makeText(DeliveryActivity.this, baseUrlValue, Toast.LENGTH_LONG).show();
                final String url = baseUrlValue + "getroute/" + CurrentUser;
                final String TEST_API_URL = "https://demo4192189.mockable.io/getroute/900";

                StringRequest stringRequest = new StringRequest(Request.Method.GET, url,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                ArrayList<HashMap<String, String>> dataItems = new ArrayList<>();
                                InputStream stream = new ByteArrayInputStream(response.getBytes(UTF_8));
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
                                String ReferenceNumber = "";
                                String RefNumber = "";
                                String Client_Name = "";
                                String Pick_Location = "";
                                String RealDestination = "";
                                String ClientId = "";
                                String StopNumber = "";
                                String Status = "";
                                String Seals = "";
                                String BranchId = "";

                                assert doc != null;
                                Element docEle = doc.getDocumentElement();
                                NodeList nl = docEle.getChildNodes();
                                if (nl != null) {
                                    int length = nl.getLength();
                                    for (int i = 0; i < length; i++) {
                                        if (nl.item(i).getNodeType() == Node.ELEMENT_NODE) {
                                            Element el = (Element) nl.item(i);
                                            if (el.getNodeName().contains(KEY_ITEM)) {
                                                ReferenceNumber = el.getElementsByTagName(KEY_REFERENCE_NUMBER).item(0).getTextContent();
                                                RefNumber = el.getElementsByTagName(KEY_REF_NUMBER).item(0).getTextContent();
                                                Client_Name = el.getElementsByTagName(KEY_CLIENT_NAME).item(0).getTextContent();
                                                Pick_Location = el.getElementsByTagName(KEY_PICK_UP_LOCATION).item(0).getTextContent();
                                                RealDestination = el.getElementsByTagName(KEY_DESTINATION).item(0).getTextContent();
                                                ClientId = el.getElementsByTagName(KEY_CLIENT_ID).item(0).getTextContent();
                                                StopNumber = el.getElementsByTagName(KEY_STOP_NUMBER).item(0).getTextContent();
                                                Status = el.getElementsByTagName(KEY_STATUS).item(0).getTextContent();
                                                Seals = el.getElementsByTagName(KEY_SEALS).item(0).getTextContent();
                                                BranchId = el.getElementsByTagName(KEY_BRANCH_ID).item(0).getTextContent();

                                                HashMap<String, String> map = new HashMap<>();
                                                map.put(KEY_REFERENCE_NUMBER, ReferenceNumber);
                                                map.put(KEY_REF_NUMBER, RefNumber);
                                                map.put(KEY_CLIENT_NAME, Client_Name);
                                                map.put(KEY_PICK_UP_LOCATION, Pick_Location);
                                                map.put(KEY_DESTINATION, RealDestination);
                                                map.put(KEY_CLIENT_ID, ClientId);
                                                map.put(KEY_STOP_NUMBER, StopNumber);
                                                map.put(KEY_STATUS, Status);
                                                map.put(KEY_SEALS, Seals);
                                                map.put(KEY_BRANCH_ID, BranchId);
                                                dataItems.add(map);
                                            } else {
                                                Toast.makeText(DeliveryActivity.this, "There are no Jobs Assigned to Route", Toast.LENGTH_LONG).show();
                                                Intent intent = new Intent(DeliveryActivity.this, DashboardActivity.class);
                                                startActivity(intent);
                                            }
                                        }
                                    }

                                }
                                // Adding menuItems to ListView
                                ListAdapter adapter = new SimpleAdapter(DeliveryActivity.this, dataItems,
                                        R.layout.list_item,
                                        new String[] { KEY_CLIENT_NAME, KEY_DESTINATION, KEY_STATUS, KEY_REFERENCE_NUMBER, KEY_PICK_UP_LOCATION, KEY_SEALS, KEY_BRANCH_ID }, new int[] {
                                        R.id.name, R.id.destination, R.id.status, R.id.refNumber, R.id.pickup, R.id.seals, R.id.branchId });
                                setListAdapter(adapter);
                                progressDialog.dismiss();

                                // selecting single ListView item
                                ListView lv = getListView();

                                lv.setOnItemClickListener(new AdapterView.OnItemClickListener() {

                                    @Override
                                    public void onItemClick(AdapterView<?> parent, View view,
                                                            int position, long id) {
                                        // getting values from selected ListItem
                                        String name = ((TextView) view.findViewById(R.id.name)).getText().toString();
                                        String destination = ((TextView) view.findViewById(R.id.destination)).getText().toString();
                                        String status = ((TextView) view.findViewById(R.id.status)).getText().toString();
                                        String refNumber = ((TextView) view.findViewById(R.id.refNumber)).getText().toString();
                                        String pickup = ((TextView) view.findViewById(R.id.pickup)).getText().toString();
                                        String seals = ((TextView) view.findViewById(R.id.seals)).getText().toString();
                                        String branchId = ((TextView) view.findViewById(R.id.branchId)).getText().toString();

                                        SharedPreferences getListView = PreferenceManager.getDefaultSharedPreferences(DeliveryActivity.this);
                                        SharedPreferences.Editor editor = getListView.edit();
                                        editor.putString("CLIENT_NAME", name);
                                        editor.putString("DESTINATION", destination);
                                        editor.putString("STATUS", status);
                                        editor.putString("REF_NUMBER", refNumber);
                                        editor.putString("PICKUP", pickup);
                                        editor.putString("SEALS", seals);
                                        editor.putString("BRANCH_ID", branchId);
                                        editor.apply();
                                        startActivity(new Intent(getApplicationContext(), ProcessActivity.class));
                                    }
                                });

                            }
                        }, new Response.ErrorListener() {
                    @Override
                    public void onErrorResponse(VolleyError error) {
                        Toast.makeText(DeliveryActivity.this, "No response from Server", Toast.LENGTH_SHORT).show();
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
                Toast.makeText(DeliveryActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }


        });
    }

    @Override
    public void onClick(View view) {
        if(view == buttonLogout){
            firebaseAuth.signOut();
            stopService(new Intent(this, TrackerService.class));
            startActivity(new Intent(this, MainActivity.class));
        }
    }

  /*  @Override
    public void onBackPressed() {
        // kill return key
    }

   private void checkConnection() {
        boolean isConnected = ConnectivityReceiver.isConnected();
        showToast(isConnected);
    }*/

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


