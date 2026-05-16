package com.rainbeta.curtistracker.model;

public class Retail {
    private String Id;
    private String Name;


    public Retail(String id, String name) {
        Id = id;
        Name = name;
    }

    public String getId() {
        return Id;
    }

    public void setId(String id) {
        Id = id;
    }

    public String getName() {
        return Name;
    }

    public void setName(String name) {
        Name = name;
    }

    @Override
    public String toString() {
        return Name;
    }

    @Override
    public boolean equals(Object obj) {
        if(obj instanceof Retail){
            Retail r = (Retail) obj;
            if(r.getName().equals(Name) && r.getId() == Id ) return true;
        }
        return false;
    }
}
