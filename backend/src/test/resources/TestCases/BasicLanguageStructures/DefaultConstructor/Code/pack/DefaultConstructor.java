package pack; // this caused NullPointerException

public class DefaultConstructor {
    void foo() {
        System.out.println(2);
    }

    public static void main(String[] args) {
        System.out.println(1);
        (new DefaultConstructor()).foo();
        System.out.println(3);
    }
}