class Dummy {
    public void main(String[] args) {}
}

class Dummy2 {
    public static void main(int[] args) {}
}

class Dummy3 {
    static void main(String[] args) {}
}

public class FileFromWebVersion { // this should be identified as the correct filename if we don't know the filename because we are in the web version
    public static void main(String[] args) {
        Out.println();
        In.read();
        Rand.randInt();
    }
}