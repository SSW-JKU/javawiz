import java.util.Comparator;
import java.util.List;

record Person(String firstName, String lastName) {
}

public class OperationAfterMin {

    public static void main(String[] args) {

        Person a = new Person("Anne", "Angelo");
        Person b = new Person("Ben", "Becker");
        Person c = new Person("Cici", "Clement");
        Person d = new Person("Don", "Danner");

        List<Person> persons = List.of(a, b, c, d);

        String result = persons.stream().map(Person::firstName).min(Comparator.comparing(firstName -> firstName.length())) + " is the shortest first name";
        Out.println(result);
    }
}
