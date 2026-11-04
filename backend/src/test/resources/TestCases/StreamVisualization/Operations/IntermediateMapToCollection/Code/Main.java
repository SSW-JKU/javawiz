import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class Main {
    public static void main(String[] args) {
        List<List<String>> words = Stream.of("a b", "c")
                .map(s -> new ArrayList<>(List.of(s.split(" "))))
                .collect(Collectors.toList());
        System.out.println(words);
        List<TreeSet<Integer>> pairs = Stream.of(1, 2)
                .map(i -> new TreeSet<>(Set.of(i, i * 2)))
                .toList();
        System.out.println(pairs);
    }
}
