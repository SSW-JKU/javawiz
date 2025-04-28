public class Main {
    public static void main (String[] args) {
        Employee e = new Employee(1l, "Lokesh", "Gupta", "gmail.com", 35);
        System.out.println(e.id());
        System.out.println(e.email());
    }
}
record Employee(Long id, String firstName, String lastName, String email, int age) {}