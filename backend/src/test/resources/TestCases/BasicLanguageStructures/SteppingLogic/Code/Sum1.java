public class Sum1 {

    static int x = 5;
    public static void main(String[] args) {
        System.out.println("Starting the program...");
        int result1 = addNumbers();
        int result2 = addNumbers();
        int result3 = addNumbers();

    }

    public static int addNumbers() {
        return x++;
    }
}