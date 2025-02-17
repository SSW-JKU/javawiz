public class Constructor {

    public static void main(String[] args) {
        new Constructor();
    }


    public Constructor() {
        System.out.println("last line"); // check if this is recognized as end of constructor (see JW-126)
    }
}
