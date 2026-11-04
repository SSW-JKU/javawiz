import java.util.Arrays;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        Stream.of("a", "bb", "ccc")
                .mapToInt(s -> s.length())
                .forEach(System.out::println);
    }
}
