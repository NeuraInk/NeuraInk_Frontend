import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { listNotes } from '../../graphql/queries';
import { withAuthenticator } from '@aws-amplify/ui-react';
import { v4 as uuidv4 } from 'uuid';
import {
  createNote as createNoteMutation,
  deleteNote as deleteNoteMutation,
} from '../../graphql/mutations';
import { API, Storage, Auth } from 'aws-amplify';
import 'react-dropzone-uploader/dist/styles.css';
import Dropzone from 'react-dropzone-uploader';

const initialFormState = { name: '', description: '' };

const Upload = () => {
  const [notes, setNotes] = useState([]);
  const [transformedImage, setTransformedImage] = useState([]);
  const [formData, setFormData] = useState(initialFormState);
  const prefixInput = 'input/';
  const prefixOutput = 'output/';

  let randomstring = require('randomstring');
  let word = randomstring.generate(5);

  const toast = (innerHTML) => {
    const el = document.getElementById('toast');
    el.innerHTML = innerHTML;
    el.className = 'show';
    setTimeout(() => {
      el.className = el.className.replace('show', '');
    }, 3000);
  };

  const getUploadParams = async ({ file }) => {
    if (!file) return;
    // setFormData({ ...formData, image: file.name, name: word });
    var file_name = uuidv4() + file.name
    const prefix_name = prefixInput.concat(file_name);
    console.log("prefix_name: ", prefix_name)
    await Promise.all([
      Storage.put(prefix_name, file, {
        level: 'public',
      }),
      createNote(),
      fetchNotes(),
    ]);
    fetchNotes();
    return { url: 'https://httpbin.org/post' };
  };

  const handleChangeStatus = async ({ file, meta, remove }, status) => {
    if (!file) return;
    setFormData({ ...formData, image: file.name, name: word });
    fetchNotes();

    if (status === 'headers_received') {
      fetchNotes();
      toast(`${meta.name} uploaded!`);
      remove();
    } else if (status === 'aborted') {
      toast(`${meta.name}, upload failed...`);
    }
  };

  const dropZone = () => (
    <React.Fragment>
      <div id='toast'>Upload</div>
      <Dropzone
        getUploadParams={getUploadParams}
        onChangeStatus={handleChangeStatus}
        maxFiles={1}
        multiple={false}
        canCancel={false}
        inputContent='Drop A File'
        styles={{
          dropzone: { width: 400, height: 200 },
          dropzoneActive: { borderColor: 'green' },
        }}
      />
    </React.Fragment>
  );

  useEffect(() => {
    fetchNotes();
    fetchTransformedImage();
  }, []);

  async function fetchNotes() {
    const apiData = await API.graphql({ query: listNotes });
    const notesFromAPI = apiData.data.listNotes.items;
    await Promise.all(
      notesFromAPI.map(async (note) => {
        if (note.image) {
          // console.log('changes');
          // const s3PrefixedNameOutput = prefixOutput.concat(note.image);
          const s3PrefixedNameInput = prefixInput.concat(note.image);
          const image = await Storage.get(s3PrefixedNameInput);
          note.image = image;
        }
        return note;
      })
    );
    setNotes(apiData.data.listNotes.items);
  }

  async function fetchTransformedImage() {
    console.log('fetch trasnforemd image');
    const dummy = 'output/output_input.jpeg';
    const transformedImage = await Storage.get(dummy);
    setTransformedImage(transformedImage);
    console.log(transformedImage);
  }

  async function createNote() {
    if (!formData.image) return;
    await API.graphql({
      query: createNoteMutation,
      variables: { input: formData },
    });

    if (formData.image) {
      const image = await Storage.get(formData.image);
      formData.image = image;
    }

    setNotes([...notes, formData]);
    setFormData(initialFormState);
  }

  async function deleteNote({ id }) {
    const newNotesArray = notes.filter((note) => note.id !== id);
    setNotes(newNotesArray);

    await Storage.remove(formData.image);

    await API.graphql({
      query: deleteNoteMutation,
      variables: { input: { id } },
    });
  }

  return (
    <div className='App'>
      <div>{dropZone()}</div>
      <div style={{ marginBottom: 30 }}>
        {notes.map((note) => (
          <div key={note.id || note.name}>
            <button onClick={() => deleteNote(note)}>Delete note</button>
            {note.image && <img src={note.image} style={{ width: 400 }} />}
          </div>
        ))}
      </div>
      <h3>Examples</h3>
      <div style={{ marginBottom: 30 }}>
        <img src={transformedImage} style={{ width: 350, padding: 30 }} />
        <img src={transformedImage} style={{ width: 350, padding: 30 }} />
      </div>
    </div>
  );
};

const dividerStyle = css`
  margin-top: 15px;
`;
const contentStyle = css`
  min-height: calc(100vh - 45px);
  padding: 0px 40px;
`;

export default withAuthenticator(Upload);
