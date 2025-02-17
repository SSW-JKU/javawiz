import java.io.*;
import java.util.LinkedList;
import java.util.stream.Collectors;

/**
 * Simple input from the keyboard or from a file.
 * <p>
 * This class allows reading formatted data either from the keyboard or from a
 * file. It is intended to be used in an introductory programming course when
 * classes, packages and exceptions are unknown at the beginning. To use it,
 * simply copy In.class into the source file directory.
 * </p>
 *
 * <p>
 * All input comes from the current input file, which is initially the keyboard.
 * Opening a file with open() makes it the new current input file. Closing a
 * file with close() switches back to the previous input file.
 * </p>
 *
 * <p>
 * When reading from the keyboard, reading blocks until the user has entered a
 * sequence of characters terminated by the return key. All methods read from
 * this input buffer (including the terminating '\r' and '\n') until the buffer
 * is fully consumed. When a method tries to read beyond the end of the buffer,
 * it blocks again waiting for the next buffer.
 * </p>
 *
 * <p>
 * End of file detection: When reading from the keyboard, eof can be signaled as
 * ctrl-Z at the beginning of a new line. When reading from a file, eof occurs
 * when an attempt is made to read beyond the end of the file. In either case
 * In.done() returns false if the requested data could not be read because of
 * eof.
 * </p>
 *
 * <p>
 *  This is a version of the In.java class which has been modified to allow JavaWiz-visualization of the current state of the input buffer.
 *  </p>
 */
public class In {

	/**
	 * End of file indicator returned by read() or peek() when no more
	 * characters can be read.
	 */
	public static final char eof = '\uffff';

	private static final int empty = '\ufffe';

	private static final char eofChar = '\u0005'; // ctrl E
	private static LookaheadReader in;
	private static LinkedList<LookaheadReader> inputStack;
	private static boolean done; // true if recent operation was successful
	private static String latestMethod;
	private static String latestValue;
	private static char[] LS; // line separator (eol)
	private static String LSSTRING;

	public static String getPast() {
		return in.past.toString();
	}

	public static String getFuture() {
		return in.future.toString();
	}

	// Do not delete unused method. Although not used by default JavaWiz JDI backend, it will be used by the JavaWiz Espresso backend for the input buffer visualization.
	public static String getLatestMethod() {
		return latestMethod;
	}

	// Do not delete unused method. Although not used by JavaWiz JDI backend, it will be used by the JavaWiz Espresso backend for the input buffer visualization.
	public static String getLatestValue() {
		return latestValue;
	}

	private static char charAfterWhiteSpace() {
		char c;
		do {
			c = read();
		} while (done && c <= ' ');
		return c;
	}

	private static String readDigits() {
		StringBuffer b = new StringBuffer();
		char c = charAfterWhiteSpace();
		if (done && c == '-') {
			b.append(c);
			c = read();
		}
		while (done && Character.isDigit(c)) {
			b.append(c);
			c = read();
		}
		if (c != eof) in.unreadLast();
		return b.toString();
	}

	private static String readFloatDigits() {
		StringBuffer b = new StringBuffer();
		char c = charAfterWhiteSpace();
		if (done && (c == '+' || c == '-')) {
			b.append(c);
			c = read();
		}
		while (done && Character.isDigit(c)) {
			b.append(c);
			c = read();
		}
		if (done && (c == '.')) {
			b.append(c);
			c = read();
			while (done && Character.isDigit(c)) {
				b.append(c);
				c = read();
			}
		}
		if (done && (c == 'e' || c == 'E')) {
			b.append(c);
			c = read();
			if (done && (c == '+' || c == '-')) {
				b.append(c);
				c = read();
			}
			while (done && Character.isDigit(c)) {
				b.append(c);
				c = read();
			}
		}
		if (c != eof) in.unreadLast();
		return b.toString();
	}

	/**
	 * Read a raw character (byte). If an attempt is made to read beyond the end
	 * of the file, eof is returned and done() yields false. Otherwise the read
	 * byte is in the range 0..255.
	 */
	public static char read() {
		char c;
		try {
			c = (char) in.read();
		} catch (IOException e) {
			done = false;
			c = eof;
		}

		if (c == eofChar && inputStack.size() == 0) {
			c = eof;
		}
		done = c != eof;
		latestValue = Character.toString(c);
		latestMethod = "read()";
		return c;
	}

	/**
	 * Current available raw characters. In case of an error 0 is returned and
	 * done() yields false.
	 */
	public static int available() {
		try {
			if (in.future.isEmpty() && !in.ready()) {
				return 0;
			} else {
				in.fillFuture();
			}
		} catch (IOException e){
		}
		return in.future.length();
	}

	/**
	 * Read a character, but skip white spaces (byte). If an attempt is made to
	 * read beyond the end of the file, eof is returned and done() yields false.
	 * Otherwise the read byte is in the range 0..255.
	 */
	public static char readChar() {
		char ch = charAfterWhiteSpace();
		latestMethod = "readChar()";
		return ch;
	}

	/**
	 * Read a boolean value. This method skips white space and tries to read an
	 * identifier. If its value is "true" the method returns true otherwise
	 * false. If the identifier is neither "true" nor "false" done() yields
	 * false.
	 */
	public static boolean readBoolean() {
		String s = readIdentifier();
		done = true;
		latestValue = s;
		latestMethod = "readBoolean()";
		if (s.equals("true")) {
			return true;
		}
		done = s.equals("false");
		return false;
	}

	/**
	 * Read an identifier. This method skips white space and tries to read an
	 * identifier starting with a letter and continuing with letters or digits.
	 * If a token of this structure could be read, it is returned otherwise the
	 * empty string is returned and done() yields false.
	 */
	public static String readIdentifier() {
		StringBuffer b = new StringBuffer();
		char c = charAfterWhiteSpace();
		if (done && Character.isLetter(c)) {
			b.append(c);
			c = read();
			while (done && (Character.isLetter(c) || Character.isDigit(c))) {
				b.append(c);
				c = read();
			}
		}
		if (c != eof) in.unreadLast();
		done = b.length() > 0;
		latestValue = b.toString();
		latestMethod = "readIdentifier()";
		return b.toString();
	}

	/**
	 * Read a word. This method skips white space and tries to read a word
	 * consisting of all characters up to the next white space or to the end of
	 * the file. If a token of this structure could be read, it is returned
	 * otherwise an empty string is returned and done() yields false.
	 */
	public static String readWord() {
		StringBuffer b = new StringBuffer();
		char c = charAfterWhiteSpace();
		while (done && c > ' ') {
			b.append(c);
			c = read();
		}
		if (c != eof) in.unreadLast();
		done = b.length() > 0;
		latestValue = b.toString();
		latestMethod = "readWord()";
		return b.toString();
	}

	/**
	 * Read a line of text. This method reads the rest of the current line
	 * (including eol) and returns it (excluding eol). A line may be empty.
	 */
	public static String readLine() {
		StringBuffer b = new StringBuffer();
		char c = read();
		while (done && !LSSTRING.contains(String.valueOf(c))) {
			b.append(c);
			c = read();
		}

		int i = 0;
		while (c == LS[i]) {
			++i;
			if (i >= LS.length) {
				break;
			}
			c = read();
		}

		if (b.length() > 0) {
			done = true;
		}
		latestValue = b.toString();
		latestMethod = "readLine()";
		return b.toString();
	}

	/**
	 * Read the whole file. This method reads from the current position to the
	 * end of the file and returns its text in a single large string. done()
	 * yields always true.
	 */
	public static String readFile() {
		StringBuffer b = new StringBuffer();
		char c = charAfterWhiteSpace();
		while (done) {
			b.append(c);
			c = read();
		}
		done = true;
		latestValue = b.toString();
		latestMethod = "readFile()";
		return b.toString();
	}

	/**
	 * Read a quote-delimited string. This method skips white space and tries to
	 * read a string in the form "...". It can be used to read pieces of text
	 * that contain white space.
	 */
	public static String readQuoted() {
		StringBuffer b = new StringBuffer();
		char c = charAfterWhiteSpace();
		if (done && c == '"') {
			c = read();
			while (done && c != '"') {
				b.append(c);
				c = read();
			}
			if (c == '"') {
				c = read();
				done = true;
			} else {
				done = false;
			}
		} else {
			done = false;
		}
		if (c != eof) in.unreadLast();
		latestValue = b.toString();
		latestMethod = "readQuoted()";
		return b.toString();
	}

	/**
	 * Read an integer. This method skips white space and tries to read an
	 * integer. If the text does not contain an integer or if the number is too
	 * big, the value 0 is returned and the subsequent call of done() yields
	 * false. An integer is a sequence of digits, possibly preceded by '-'.
	 */
	public static int readInt() {
		String s = readDigits();
		latestMethod = "readInt()";
		try {
			done = true;
			latestValue = s;
			return Integer.parseInt(s);
		} catch (Exception e) {
			done = false;
			latestValue = String.valueOf(0);
			return 0;
		}
	}

	/**
	 * Read a long integer. This method skips white space and tries to read a
	 * long integer. If the text does not contain a number or if the number is
	 * too big, the value 0 is returned and the subsequent call of done() yields
	 * false. A long integer is a sequence of digits, possibly preceded by '-'.
	 */
	public static long readLong() {
		String s = readDigits();
		latestMethod = "readLong()";
		try {
			done = true;
			latestValue = s;
			return Long.parseLong(s);
		} catch (Exception e) {
			done = false;
			latestValue = String.valueOf(0);
			return 0;
		}
	}

	/**
	 * Read a float value. This method skips white space and tries to read a
	 * float value. If the text does not contain a float value or if the number
	 * is not well-formed, the value 0f is returned and the subsequent call of
	 * done() yields false. An float value is as specified in the Java language
	 * description. It may be preceded by a '+' or a '-'.
	 */
	public static float readFloat() {
		String s = readFloatDigits();
		latestMethod = "readFloat()";
		try {
			done = true;
			latestValue = s;
			return Float.parseFloat(s);
		} catch (Exception e) {
			done = false;
			latestValue = String.valueOf(0f);
			return 0f;
		}
	}

	/**
	 * Read a double value. This method skips white space and tries to read a
	 * double value. If the text does not contain a double value or if the
	 * number is not well-formed, the value 0.0 is returned and the subsequent
	 * call of done() yields false. An double value is as specified in the Java
	 * language description. It may be preceded by a '+' or a '-'.
	 */
	public static double readDouble() {
		String s = readFloatDigits();
		latestMethod = "readDouble()";
		try {
			done = true;
			latestValue = s;
			return Double.parseDouble(s);
		} catch (Exception e) {
			done = false;
			latestValue = String.valueOf(0.0);
			return 0.0;
		}
	}

	/**
	 * Peek at the next character. This method skips white space and returns the
	 * next character without removing it from the input stream. It can be used
	 * to find out, what token comes next in the input stream.
	 */
	public static char peek() {
		char c = charAfterWhiteSpace();
		if (c != eof) in.unreadLast();
		latestValue = Character.toString(c);
		latestMethod = "peek()";
		return c;
	}

	/**
	 * Open a text file for reading The text file with the name fn is opened as
	 * the new current input file. When it is closed again, the previous input
	 * file is restored.
	 */
	public static void open(String fn) {
		try {
			LookaheadReader s = new LookaheadReader(new FileInputStream(fn));
			inputStack.add(in);
			in = s;
			done = true;
		} catch (FileNotFoundException e) {
			done = false;
		}
		latestMethod = "open()";
	}

	/**
	 * Close the current input file. The current input file is closed and the
	 * previous input file is restored. Closing the keyboard input has no effect
	 * but causes done() to yield false.
	 */
	public static void close() {
		try {
			if (inputStack.size() > 0) {
				in.close();
				in = inputStack.removeLast();
				done = true;
			} else {
				done = false;

			}
		} catch (IOException e) {
			done = false;
		}
		latestMethod = "close()";
	}

	/**
	 * Check if the previous operation was successful. This method returns true
	 * if the previous read operation was able to read a token of the requested
	 * structure. It can also be called after open() and close() to check if
	 * these operations were successful. If done() is called before any other
	 * operation it yields true.
	 */
	public static boolean done() {
		return done;
	}

	static { // initializer
		done = true;
		latestValue = "";
		latestMethod = "";
		in = new LookaheadReader(System.in);
		inputStack = new LinkedList<LookaheadReader>();
		LS = System.getProperty("line.separator").toCharArray();
		if (LS == null || LS.length == 0) {
			LS = new char[] { '\n' };
		}
		LSSTRING = new String(LS);
	}

	public static void debugOutput() {
		String p = in.past.chars().mapToObj(c -> debugChar((char)c)).collect(Collectors.joining("", "[", "]"));
		String f = in.future.chars().mapToObj(c -> debugChar((char)c)).collect(Collectors.joining("", "[", "]"));
		System.out.println("%s | %s".formatted(p, f));
	}

	private static String debugChar(char c) {
		return switch (c) {
			case '\n' -> "\\n";
			case '\r' -> "\\r";
			case '\uffff' -> " eof ";
			default -> String.valueOf(c);
		};
	}

	//inner class
	static class LookaheadReader extends FilterReader {

		private StringBuilder past = new StringBuilder();
		private StringBuilder future = new StringBuilder();

		public LookaheadReader(Reader in) {
			super(in);
		}

		public LookaheadReader(InputStream inputStream) {
			super(new InputStreamReader(inputStream));
		}

		@Override
		public int read() throws IOException {
			fillFuture();
			if (!future.isEmpty()) {
				char c = future.charAt(0);
				future.deleteCharAt(0);
				past.append(c);
				return c;
			} else {
				throw new EOFException();
			}
		}

		void unreadLast() {
			char c = past.charAt(past.length() - 1);
			future.insert(0, c);
			past.deleteCharAt(past.length() - 1);
		}


		private void fillFuture() throws IOException {
			if (shouldFill()) {
				int c = in.read(); //blocking
				while (c != -1) {
					future.append((char) c);
					if (in.ready()) {
						c = in.read();
					} else {
						break;
					}
				}
			}
		}

		private boolean shouldFill() throws IOException {
			return future.isEmpty() || in.ready();
		}
	}
}
