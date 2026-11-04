import java.util.List;
import java.util.stream.IntStream;

record Person(String firstName, String lastName) {}

public class HelloWorld {
    public static void main(String[] args) {
        List<Integer> numbers = List.of(1, 2, 3, 4, 5, 6);

        numbers.stream()
                .filter(n -> n % 2 == 0)
                .map(n -> n * n)
                .forEach(System.out::println);
    }
}
