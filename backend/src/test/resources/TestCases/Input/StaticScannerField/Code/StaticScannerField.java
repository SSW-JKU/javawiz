import java.util.Scanner;

public class StaticScannerField {
    static Scanner sc = new Scanner(System.in);

    public static void main(String[] args) {
        int value = sc.nextInt();
        System.out.println("read " + value);
    }
}
