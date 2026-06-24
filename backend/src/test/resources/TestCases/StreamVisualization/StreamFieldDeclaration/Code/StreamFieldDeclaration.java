import java.util.Comparator;
import java.util.List;
import java.util.Optional;

record Person(String firstName, String lastName) {
}

public class StreamFieldDeclaration {

    Person a = new Person("Anne", "Angelo");
    Person b = new Person("Ben", "Becker");
    Person c = new Person("Cici", "Clement");
    Person d = new Person("Don", "Danner");

    List<Person> persons = List.of(a, b, c, d);

    Optional<String> result = persons.stream().map(Person::firstName).min(Comparator.comparing(firstName -> firstName.length()));

    public static void main(String[] args) {
        Out.println(new StreamFieldDeclaration().result);
    }
}
