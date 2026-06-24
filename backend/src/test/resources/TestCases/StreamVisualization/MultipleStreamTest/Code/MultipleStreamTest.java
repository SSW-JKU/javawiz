import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

record Person(String firstName, String lastName) {
}

public class MultipleStreamTest {

    private static Stream<Character> charsOf(String str) {
        return str.chars().mapToObj(codePoint -> Character.toUpperCase((char) codePoint));
    }

    public static void main(String[] args) {

        Random rng = new Random(0);

        // order of operation matters
        IntStream.generate(() -> rng.nextInt(8))
                .distinct()
                .limit(5)
                .forEach(System.out::println);

        IntStream.generate(() -> rng.nextInt(8))
                .limit(5)
                .distinct()
                .forEach(System.out::println);

        Person a = new Person("Anne", "Angelo");
        Person b = new Person("Ben", "Becker");
        Person c = new Person("Cici", "Clement");
        Person d = new Person("Don", "Danner");

        List<Person> persons = List.of(a, b, c, d);

        // filter + map: the typical combination
        persons.stream()
                .filter(p -> p.firstName().length() == 4)
                .map(p -> p.firstName().charAt(0))
                .forEach(System.out::println);

        // flatMap: one-to-many mapping
        // find out how many different letters appear in our persons' names
        long nLetters = persons.stream()
                .flatMap(p -> charsOf(p.firstName()))
                .distinct()
                .count();

        // ===================
        // TERMINAL OPERATIONS
        // ===================

        // toList / toArray: collect final result into a list or an array
        List<Person> fourLetterPersons =
                persons.stream()
                        .filter(p -> p.firstName().length() == 4)
                        .toList();

        // collect - groupingBy: group persons by first name length
        Map<Integer, List<Person>> map =
                persons.stream()
                        .collect(Collectors.groupingBy(p -> p.firstName().length()));

    }
}
