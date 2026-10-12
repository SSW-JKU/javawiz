import java.util.Optional;
import java.util.stream.Stream;

public class StreamExamples {

    static Stream<String> staticStream = null;

    static Optional<String> consume(Stream<String> stream) {
        return jwdebug.$JavaWiz.completeStreamVisualization("findFirst", 0, "", stream.peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "sorted", 1, "")).sorted().peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "sorted", 1, "")).peek(element -> jwdebug.$JavaWiz.traceStream("END", element, "findFirst", 0, "")).findFirst());
    }

    static Stream<String> source() {
        return Stream.of("Max", "Susi", "Maya").peek(element -> jwdebug.$JavaWiz.traceStream("START", element, "of", 3, "\"Max\""))
                .peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 2, "(x)->x.length() > 3")).filter(x -> x.length() > 3).peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 2, "(x)->x.length() > 3"));
    }

    static Stream<String> sourceSplit1() {
        return source();
    }

    static Stream<String> sourceSplit2() {
        return source().peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 4, "(x)->x.length() < 10")).filter(x -> x.length() < 10).peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 4, "(x)->x.length() < 10"));
    }

    private static Stream<Character> charsOf(String str) {
        return str.chars().peek(element -> jwdebug.$JavaWiz.traceStream("START", element, "chars", 6, ""))
                .peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "mapToObj", 5, "(codePoint)->Character.toUpperCase((char)codePoint)")).mapToObj(codePoint -> Character.toUpperCase((char) codePoint)).peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "mapToObj", 5, "(codePoint)->Character.toUpperCase((char)codePoint)"));
    }

    public static void main(String[] args) {
        jwdebug.$JavaWiz.completeStreamVisualization("count", 7, "", source()
                .peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 8, "(x)->x.charAt(0) == 'M'")).filter(x -> x.charAt(0) == 'M').peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 8, "(x)->x.charAt(0) == 'M'"))
                .peek(element -> jwdebug.$JavaWiz.traceStream("END", element, "count", 7, "")).count());

        consume(
                Stream.of("Max", "Susi", "Maya").peek(element -> jwdebug.$JavaWiz.traceStream("START", element, "of", 10, "\"Max\""))
                        .peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 9, "(x)->x.length() > 3")).filter(x -> x.length() > 3).peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 9, "(x)->x.length() > 3"))
        );

        var m1 = consume(sourceSplit1().peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 11, "(a)->a.charAt(0) == 'M'")).filter(a -> a.charAt(0) == 'M').peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 11, "(a)->a.charAt(0) == 'M'")));
        var s1 = consume(sourceSplit1().peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 12, "(b)->b.charAt(0) == 'S'")).filter(b -> b.charAt(0) == 'S').peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 12, "(b)->b.charAt(0) == 'S'")));
        var m2 = consume(sourceSplit2().peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 13, "(a)->a.charAt(0) == 'M'")).filter(a -> a.charAt(0) == 'M').peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 13, "(a)->a.charAt(0) == 'M'")));

        Stream<String> intermediate = sourceSplit2().peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 14, "(x)->!x.contains(\"X\")")).filter(x -> !x.contains("X")).peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 14, "(x)->!x.contains(\"X\")"));
        var s2 = consume(intermediate.peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 15, "(b)->b.charAt(0) == 'S'")).filter(b -> b.charAt(0) == 'S').peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 15, "(b)->b.charAt(0) == 'S'")));

        var characters1 = jwdebug.$JavaWiz.completeStreamVisualization("count", 16, "", source()
                .peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "flatMap", 18, "StreamExamples::charsOf")).flatMap(jwdebug.$JavaWiz.wrapFlatMapMapper(18, StreamExamples::charsOf)).peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "flatMap", 18, "StreamExamples::charsOf"))
                .peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 17, "(c)->c != 'A'")).filter(c -> c != 'A').peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 17, "(c)->c != 'A'"))
                .peek(element -> jwdebug.$JavaWiz.traceStream("END", element, "count", 16, "")).count());

        var characters2 = jwdebug.$JavaWiz.completeStreamVisualization("count", 19, "", Stream.of("Kate", "Hans", "Pineapple").peek(element -> jwdebug.$JavaWiz.traceStream("START", element, "of", 23, "\"Kate\""))
                .peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "filter", 22, "(x)->x.length() > 3")).filter(x -> x.length() > 3).peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "filter", 22, "(x)->x.length() > 3"))
                .peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "flatMap", 21, "StreamExamples::charsOf")).flatMap(jwdebug.$JavaWiz.wrapFlatMapMapper(21, StreamExamples::charsOf)).peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "flatMap", 21, "StreamExamples::charsOf"))
                .peek(element -> jwdebug.$JavaWiz.traceStream("IN", element, "distinct", 20, "")).distinct().peek(element -> jwdebug.$JavaWiz.traceStream("OUT", element, "distinct", 20, ""))
                .peek(element -> jwdebug.$JavaWiz.traceStream("END", element, "count", 19, "")).count());

        if (Math.random() < 0.5) {
            staticStream = source();
        } else {
            staticStream = Stream.of("Kate", "Hans", "Pineapple the fruit dude").peek(element -> jwdebug.$JavaWiz.traceStream("START", element, "of", 24, "\"Kate\""));
        }

        var result = consume(staticStream);
    }
}
