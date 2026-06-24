import java.util.List;
import java.util.stream.Collectors;

record Person(String firstName, String lastName) {
}

public class OperationAfterCollectTest {

    public static void main(String[] args) {

        Person a = new Person("Anne", "Angelo");
        Person b = new Person("Ben", "Becker");
        Person c = new Person("Cici", "Clement");
        Person d = new Person("Don", "Danner");

        List<Person> persons = List.of(a, b, c, d);

        String result = "The names of all persons are " + persons.stream().map(Person::firstName).collect(Collectors.joining()) + ", that's all";
        Out.println(result);

    }
}
