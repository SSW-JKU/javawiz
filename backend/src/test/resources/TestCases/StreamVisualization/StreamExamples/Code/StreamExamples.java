import java.util.Optional;
import java.util.stream.Stream;

public class StreamExamples {

    static Stream<String> staticStream = null;

    static Optional<String> consume(Stream<String> stream) {
        return stream.sorted().findFirst();
    }

    static Stream<String> source() {
        return Stream.of("Max", "Susi", "Maya")
                .filter(x -> x.length() > 3);
    }

    static Stream<String> sourceSplit1() {
        return source();
    }

    static Stream<String> sourceSplit2() {
        return source().filter(x -> x.length() < 10);
    }

    private static Stream<Character> charsOf(String str) {
        return str.chars()
                .mapToObj(codePoint -> Character.toUpperCase((char) codePoint));
    }

    public static void main(String[] args) {
        source()
                .filter(x -> x.charAt(0) == 'M')
                .count();

        consume(
                Stream.of("Max", "Susi", "Maya")
                        .filter(x -> x.length() > 3)
        );

        var m1 = consume(sourceSplit1().filter(a -> a.charAt(0) == 'M'));
        var s1 = consume(sourceSplit1().filter(b -> b.charAt(0) == 'S'));
        var m2 = consume(sourceSplit2().filter(a -> a.charAt(0) == 'M'));

        Stream<String> intermediate = sourceSplit2().filter(x -> !x.contains("X"));
        var s2 = consume(intermediate.filter(b -> b.charAt(0) == 'S'));

        var characters1 = source()
                .flatMap(StreamExamples::charsOf)
                .filter(c -> c != 'A')
                .count();

        var characters2 = Stream.of("Kate", "Hans", "Pineapple")
                .filter(x -> x.length() > 3)
                .flatMap(StreamExamples::charsOf)
                .distinct()
                .count();

        if (Math.random() < 0.5) {
            staticStream = source();
        } else {
            staticStream = Stream.of("Kate", "Hans", "Pineapple the fruit dude");
        }

        var result = consume(staticStream);
    }
}
