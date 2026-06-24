public class InOutsideInout {
    public static void main(String[] args) {
        In.open(System.getProperty("user.dir") + "/src/test/resources/TestCases/InViz/InOutsideInout/numbers.txt");
        int a = In.readInt();
    }
}