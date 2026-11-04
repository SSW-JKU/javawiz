import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        List<String[]> words = Stream.of("a b", "c")
                .map(s -> s.split(" "))
                .toList();
        System.out.println(words.size());
        Stream.of(1, 2)
                .map(i -> new int[]{i, i * 2})
                .forEach(a -> System.out.println(Arrays.toString(a)));
    }
}
