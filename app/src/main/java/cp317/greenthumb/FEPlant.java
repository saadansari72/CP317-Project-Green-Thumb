
package cp317.greenthumb;

public class FEPlant {
    private int _id;
    private String _name;
    private String _bio;

    FEPlant(int id, String name, String bio) {
        this._id = id;
        this._name = name;
        this._bio = bio;
    }

    public int get_id() {
        return _id;
    }

    public String get_name() {
        return _name;
    }

    public String get_bio() {
        return _bio;
    }
}