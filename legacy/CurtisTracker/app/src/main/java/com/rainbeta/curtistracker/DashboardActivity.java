package com.rainbeta.curtistracker;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.support.v7.app.AppCompatActivity;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.Toast;

import com.google.firebase.auth.FirebaseAuth;
import com.rainbeta.curtistracker.model.Locations;

import java.util.UUID;

import io.realm.Realm;
import io.realm.RealmQuery;
import io.realm.RealmResults;

public class DashboardActivity extends AppCompatActivity {

    private FirebaseAuth firebaseAuth;
    private Realm realm;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_dashboard);
        realm = Realm.getDefaultInstance();
        setTitle("CurTIS");
        requestPermissionState();
        requestPermissionLocation();
        requestPermissionStorage();
        startService();
      //  savetodb();
        ImageButton deliveryButton = findViewById(R.id.delivery);
        ImageButton pickupButton = findViewById(R.id.pickup);
        ImageButton RouteButton = findViewById(R.id.RouteScan);
        ImageButton BankButton = findViewById(R.id.BankScan);
        ImageButton RetailButton = findViewById(R.id.RetailEvac);
        ImageButton IncidentButton = findViewById(R.id.ReportIncidents);
        ImageView mapView = findViewById(R.id.logoView);
      //  ImageButton startEndDay = findViewById(R.id.startendday);
        firebaseAuth = FirebaseAuth.getInstance();

        mapView.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(DashboardActivity.this, MoveActivity.class);
                startActivity(intent);
            }
        });


        deliveryButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(DashboardActivity.this, DeliveryActivity.class);
                startActivity(intent);
            }
        });

        pickupButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(DashboardActivity.this, ManualActivity.class);
                startActivity(intent);

            }
        });

        RouteButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(DashboardActivity.this, RouteActivity.class);
                startActivity(intent);

            }
        });

        BankButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(DashboardActivity.this, BankActivity.class);
                startActivity(intent);

            }
        });


        RetailButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(DashboardActivity.this, RetailActivity.class);
                startActivity(intent);
            }
        });

        IncidentButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(DashboardActivity.this, IncidentActivity.class);
                startActivity(intent);
            }
        });
      /*  startEndDay.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                Intent intent = new Intent(DashboardActivity.this, DailyActivity.class);
                startActivity(intent);
            }
        });*/
       // viewData();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.activity_dash_actions, menu);
        return super.onCreateOptionsMenu(menu);
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Take appropriate action for each action item click
        switch (item.getItemId()) {
            case R.id.start_end:
                Intent intent = new Intent(DashboardActivity.this, DailyActivity.class);
                startActivity(intent);
                return true;

            case R.id.action_logout:
                LogOutUser();
                return true;
            default:
                return super.onOptionsItemSelected(item);
        }
    }

      @Override
      public void onBackPressed() {
          // kill return key
      }

    private void LogOutUser() {
        firebaseAuth.signOut();
        stopService(new Intent(this, TrackerService.class));
        startActivity(new Intent(this, MainActivity.class));
    }

    public void requestPermissionState() {
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED ) {
            int REQUEST_CODE_ASK_PERMISSIONS_TWO = 321;
            ActivityCompat
                    .requestPermissions(DashboardActivity.this, new String[]{android.Manifest.permission.READ_PHONE_STATE}, REQUEST_CODE_ASK_PERMISSIONS_TWO);
        }
    }

    private void requestPermissionLocation() {
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED ) {
            int REQUEST_CODE_ASK_PERMISSIONS = 123;
            ActivityCompat
                    .requestPermissions(DashboardActivity.this, new String[]{android.Manifest.permission.ACCESS_FINE_LOCATION}, REQUEST_CODE_ASK_PERMISSIONS);
        }
    }

    private void requestPermissionStorage() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED ) {
            int REQUEST_CODE_ASK_PERMISSIONS_THREE = 321;
            ActivityCompat
                    .requestPermissions(DashboardActivity.this, new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQUEST_CODE_ASK_PERMISSIONS_THREE);
        }
    }

    private void startService(){
        startService(new Intent(this, TrackerService.class));
    }

    private void savetodb(){
        realm.beginTransaction();
            Locations locations = realm.createObject(Locations.class);
            locations.setId(UUID.randomUUID().toString());
            locations.setDate("Today");
            locations.setDeviceid("080");
            locations.setLatitude("22");
            locations.setLongitude("11");
            locations.setUserid("77");
            locations.setStatus(1);
        realm.commitTransaction();
    }
    private void viewData(){
        RealmQuery<Locations> query = realm.where(Locations.class);
        RealmResults<Locations> locationResults = query.findAll();
        for(Locations result : locationResults) {

            Toast.makeText(DashboardActivity.this, result.getId() + result.getStatus(), Toast.LENGTH_SHORT).show();
            //Similarly you can retrieve more fields.
        }
    }
}
