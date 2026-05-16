package com.rainbeta.curtistracker;

import android.app.Application;

import io.realm.Realm;
import io.realm.RealmConfiguration;

/**
 * Created by Bello Sodiq on 9/21/2017.
 */

public class BaseApplication extends Application {

    private static BaseApplication mInstance;

    @Override
    public void onCreate() {
        super.onCreate();
        mInstance = this;
        Realm.init(this);
        RealmConfiguration config = new RealmConfiguration.Builder().name("curtis.realm").build();
        config.shouldDeleteRealmIfMigrationNeeded();
        Realm.setDefaultConfiguration(config);
    }

    public static synchronized BaseApplication getInstance() {
        return mInstance;
    }

    public void setConnectivityListener(ConnectivityReceiver.ConnectivityReceiverListener listener) {
        ConnectivityReceiver.connectivityReceiverListener = listener;
    }
}
